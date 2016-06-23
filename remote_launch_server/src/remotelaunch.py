#! /usr/bin/env python
import roslib, rospy, csv, itertools, sys
from processhandle import ProcessHandler
from remote_launch_server.srv import *
from remote_launch_server.msg import *


class RemoteLaunchServer:
    def __init__(self):

        # Init node
        self.node_name = 'remote_launch_server'
        rospy.init_node(self.node_name)

        # Set node rate to 1Hz
        rate = rospy.Rate(1)

        # Get config file parameter
        filename = rospy.get_param("/"+self.node_name+"/cfg_file", "../config/launch_cfg.csv")
        
        # Read config file
        self.read_cfg(filename)

        # Initiate services servers
        self.start_launch_file_server()
        self.stop_launch_file_server()

        # Initiate publishers
        self.publisher_list_launch_files = self.list_launch_files_publisher()
        try:
            self.publisher_list_launch_files
        except:
            rospy.loginfo("Deleting node %s", self.node_name)
            sys.exit()

        # Handle callbacks and publish messages
        while not rospy.is_shutdown():

            # Call publisher for list_launch_files topic
            self.publish_list_launch_files(self.publisher_list_launch_files, self.launch_list)

            # Sleep based on time this loop took
            rate.sleep()

    # Reads filename as a CSV file where a line for each launch file configuration
    # Parameters are comma separated in the order (name, command, working_directory)
    def read_cfg(self, filename):

        rospy.logdebug("Will try to read file %s",filename)

        # List of LaunchFile objects
        self.launch_list = []

        # Open file, raises IOError exception on failure
        try:
            csvfile = open(filename, 'rb')
        except IOError as err:
            rospy.logerr("Failed opening file %s: %s", filename, err.strerror)
            return

        # Read file with csv module
        reader = csv.reader(csvfile, delimiter=',', quoting=csv.QUOTE_ALL) # comma separated values
        try:
            for row in reader:
                # Append a LaunchFile object with the parameters in row to launch_list
                self.launch_list.append(LaunchFile(row))
        except csv.Error as err:
            rospy.logerr("Failed reading file %s, line %d: %s", filename, reader.line_num, err)
            return

        rospy.loginfo("Successfully read %d launch files from file %s", len(self.launch_list), filename)


    # Prints the launch_list list, mainly used for debugging
    def print_cfg(self):
        for lf in self.launch_list:
            rospy.loginfo("%d. Name: %s Command: %s Directory: %s", lf.id, lf.name, lf.cmd, lf.wd)        

    # StartLaunchFile service server
    def start_launch_file_server(self):

        try:
            # Doesn't need a huge buffer
            self.server_start_launch_file = rospy.Service(self.node_name+'/StartLaunchFile', StartLaunchFile, self.handle_start_launch_file, 20)
        except rospy.ServiceException, e:
            rospy.logerr("Service StartLaunchFile creation failed: %s", e)
            return

        rospy.loginfo("Service StartLaunchFile has started")

    # StartLaunchFile service handler
    def handle_start_launch_file(self, req):
        rospy.logdebug("Received request to start file with id %d", req.rlf.id)

        # Command arguments (optional)
        args = req.args

        # Prevent dangerous arguments characters
        if ('&' in args) or (';' in args):
            args = ''

        reqid = req.rlf.id
        # Check if LaunchFile id exists
        if reqid > len(self.launch_list):
            rospy.logwarn("Id %d requested was not found", reqid)
            return StartLaunchFileResponse(success=False)

        # Get information from the LaunchFile object
        thisLF = self.launch_list[reqid]

        # Check if the process is already running
        try:
            thisLF.process
            rospy.logwarn("Id %d already has a running process", reqid)
            return StartLaunchFileResponse(success=False)
        except:
            pass
        
        # Attach a ProcessHandler object to with the command + args
        thisLF.process = ProcessHandler(thisLF.cmd + ' ' + args, thisLF.wd)

        rospy.loginfo("Successfully started file with id %d", reqid)
        # Service response
        return StartLaunchFileResponse(success=True)

    # StopLaunchFile service server
    def stop_launch_file_server(self):
        
        try:
            # Doesn't need a huge buffer
            self.server_stop_launch_file = rospy.Service(self.node_name+'/StopLaunchFile', StopLaunchFile, self.handle_stop_launch_file, 20)
        except rospy.ServiceException, e:
            rospy.logerr("Service StopLaunchFile creation failed: %s", e)
            return

        rospy.loginfo("Service StopLaunchFile has started")    

    # StopLaunchFile service handler
    def handle_stop_launch_file(self, req):
        reqid = req.rlf.id
        rospy.logdebug("Received request to stop file with id %d", reqid)

        # Check if LaunchFile id exists
        if reqid > len(self.launch_list):
            rospy.logwarn("Id %d requested was not found", reqid)
            return StopLaunchFileResponse(success=False)

        # Get information from the LaunchFile object
        thisLF = self.launch_list[reqid]

        # Check if there is a running process
        try:
            thisLF.process
        except:
            rospy.logwarn("Id %d requested does not have a running process", reqid)
            return StopLaunchFileResponse(success=False)
        else:
            # Deleting the object terminates safely, might take some time
            del thisLF.process

            rospy.loginfo("Successfully stopped file with id %d", reqid)
            # Service response
            return StopLaunchFileResponse(success=True)

    # Create the list_launch_files topic publisher
    def list_launch_files_publisher(self):
        try:
            # Publishes an array of std_msgs/UInt8 values
            pub = rospy.Publisher(self.node_name+'/list_launch_files', RemoteLaunchFileArray, queue_size=2)
        except rospy.ROSException, e:
            rospy.logerr("Publisher list_launch_files creation failed: %s", e)
            return
        else:
            return pub

    # Publish RemoteLaunchFileArray messages in list_launch_files topic
    def publish_list_launch_files(self, publisher, launch_list):
        
        # Array of RemoteLaunchFile messages
        '''
        RemoteLaunchFile.msg
        -uint8 id
        -string name
        -string command
        -string working_directory
        -bool running
        '''

        # Initiate the message
        msg = RemoteLaunchFileArray()

        # Go through all the available launch files
        for lf in launch_list:

            # Create object with all parameters except 'running'
            rlf = RemoteLaunchFile(id=lf.id, name=lf.name, command=lf.cmd, working_directory=lf.wd)

            # Find out if process is running
            try:
                # Touch process object, will raise exception if does not exist
                lf.process
            except:
                rlf.running = False
            else:
                rlf.running = lf.process.is_active()
                if not rlf.running:
                    # Kill process, something went wrong
                    del lf.process

            # Append this object to array
            msg.rlf_array.append(rlf)

        # Publish the message
        publisher.publish(msg)




class LaunchFile:
    # Persistent _ID in class scope
    _ID = itertools.count(0)

    # Class constructor, expects parameters as a list of strings in the order (name, command, working_directory)
    def __init__(self, parameters):
        # Store _ID in this instance and increment for the next instance of class
        self.id = self._ID.next()
        # Name as a description of the command
        self.name = parameters[0]
        # Command to run
        self.cmd = parameters[1]
        # Working directory
        self.wd = parameters[2]


#Main function
if __name__ == '__main__':
    try:
        rl = RemoteLaunchServer()
    except rospy.ROSInterruptException:
        pass