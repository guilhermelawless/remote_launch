#! /usr/bin/env python
import signal, psutil, subprocess

class ProcessHandler:
    '''This class interacts directly with system to run a system command'''

    def __init__(self, command, cwdopt="./"):
        '''Runs the command and accepts a custom working directory'''
        self.p = psutil.Popen(command, stdin=subprocess.PIPE, shell=True, cwd=cwdopt)

    def is_active(self):
        '''Tries to verify if the file is still active, returning true if so'''
        self.p.poll()
        ret = True if (self.p.returncode == None) else False
        return ret

    def kill_proc_tree(self):
        '''Kills the process'''
        # Get all children recursively
        children = self.p.get_children(recursive=True)

        # Try to SIGINT first
        for child in children:
            child.send_signal(signal.SIGINT)
        gone, alive = psutil.wait_procs(children, timeout=2)

        # Try to SIGTERM those that are alive
        for child in alive:
            child.terminate()
        gone, alive = psutil.wait_procs(children, timeout=1)

        # Finally brute force kill those alive
        for child in alive:
            child.kill()

    def __del__(self):
        '''Destructor of this object should first kill the process'''
        self.kill_proc_tree()

        # Older version, keeping here but deprecated
        '''
        # Full credit to http://stackoverflow.com/questions/392022/best-way-to-kill-all-child-processes/8544913#8544913
        # Modified to send SIGINT signal to kill processes
        pid = self.p.pid
        subprocess.Popen("kill -INT `pstree -p %d | grep -oP '(?<=\()[0-9]+(?=\))'`" % pid, shell=True)

        # Kill processes that did not exit on SIGINT
        #TODO: find if there are any processes left before trying this
        time.sleep(1)
        subprocess.Popen("kill `pstree -p %d | grep -oP '(?<=\()[0-9]+(?=\))'`" % pid, shell=True)
        '''

        # Oldest version, keeping here but deprecated
        '''
        ps_command = subprocess.Popen("ps -o pid --ppid %d --noheaders" % self.p.pid, shell=True, stdout=subprocess.PIPE)
        ps_output = ps_command.stdout.read()
        retcode = ps_command.wait()
        assert retcode == 0, "ps command returned %d" % retcode
        for pid_str in ps_output.split("\n")[:-1]:
            os.kill(int(pid_str), signal.SIGINT)
            time.sleep(1)
        self.p.kill()
        self.p.terminate()
        '''


