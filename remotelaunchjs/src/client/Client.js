
/**
 * @author Guilherme Lawless - guilherme.lawless@gmail.com
 */

/**
 * A Client interacts with a RemoteLaunchServer, showing information
 * on different launch files previously configured in a config file, and calling
 * services to start and stop those launch files.
 *
 * Emits the following events:
 *   * 'list_update' - there was an update in the file list
 *   * 'fileStart' - a process has started or was running when page was loaded - sends the file name as an argument
 *   * 'fileStop' - a process has stopped - sends the file name as an argument
 *
 * @constructor
 * @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * topic (optional) - the topic with information on launch files (default: '/list_launch_files')
 *   * serverName (optional) - the server node name, used for namespaces (default: '/remote_launch_server')
 */
REMOTELAUNCH.Client = function(options, debug) {
  var that = this;
  options = options || {};
  var ros = options.ros;
  var serverName = options.serverName || '/remote_launch_server';
  var topic = options.topic || '/list_launch_files';
  var messageType = '/remote_launch_server/RemoteLaunchFileArray';

  // Setup the topic subscriber
  var topicSubscriber = new ROSLIB.Topic({
    ros : ros,
    name : serverName+topic,
    messageType : messageType
  });

  // Used in for loops
  var index;

  // Set event emitter
  this.eventEmitter = new EventEmitter2();

  // Topic callback
  topicSubscriber.subscribe(function(message) {

    // First callback - create a File object for each in the message rlf_array
    if (!that.listCreated){
      that.list = [];
      for (index=0; index<message.rlf_array.length; index++) {

        var rlf = message.rlf_array[index];

        // Create File object with parameters given by the current rlf in rlf_array
        var file = new REMOTELAUNCH.File({
          ros : ros,
          serverName : serverName,
          id : rlf.id,
          name : rlf.name,
          wd : rlf.working_directory,
          cmd : rlf.command,
          running : rlf.running,
          inputIdPrefix : 'buttonInput',
        });

        // If the file was running when page is loaded, emit a fileStart
        if(rlf.running) {
          that.eventEmitter.emit('fileStart', rlf.name);
        }
        
        // Push object into file list
        that.list.push(file);
      }

      // Don't need to create this list again
      that.listCreated = true;
    }

    // List already created, update it. Expects the same ordering of files
    else {
      for (index=0; index<message.rlf_array.length; index++) {
        that.list[index].running = message.rlf_array[index].running;
      }
    }

    that.eventEmitter.emit('list_update');
  });

  // This function should be called by an event on another class
  this.handleFileClick = function(fileID, fileName) {

    var file = that.list[fileID];

    if(file.isRunning() === false){
      file.start();
      that.eventEmitter.emit('fileStart', fileName);
    }

    else{
      file.stop();
      that.eventEmitter.emit('fileStop', fileName);
    }
  };
};