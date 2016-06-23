
/**
 * @author Guilherme Lawless - guilherme.lawless@gmail.com
 */

/**
 * A File is used to store information on a single launch file and call
 * services to start and stop this file
 *
 * @constructor
 * @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * serverName (optional) - the server node name, used for namespaces (default: '/remote_launch_server')
 *   * id - the identification number of this process
 *   * name - the name of this process
 *   * wd - the working directory for this process
 *   * command - the command that will be run by this process
 *   * running - boolean representing if the process is currently running
 *   * inputIdPrefix - (optional) prefix for all buttonInput ids (default: 'buttonInput')
 */
REMOTELAUNCH.File = function(options) {
    var that = this;
    options = options || {};
    var ros = options.ros;
    var serverName = options.serverName || '/remote_launch_server';
    var inputIdPrefix = options.inputIdPrefix || 'buttonInput';
    this.id = options.id;
    this.name = options.name;
    this.wd = options.wd;
    this.command = options.cmd;
    this.running = options.running;

    // Setup service clients
    var startClient = new ROSLIB.Service({
      ros : ros,
      name : serverName + '/StartLaunchFile',
      serviceType : 'remote_launch_server/StartLaunchFile'
    });

    var stopClient = new ROSLIB.Service({
      ros : ros,
      name : serverName + '/StopLaunchFile',
      serviceType : 'remote_launch_server/StopLaunchFile'
    });

    this.isRunning = function(){
      return this.running;
    };

    // Used to easily build the service request
    this.buildStartRequest = function(){
      // Mimic remote_launch/RemoteLaunchFile.msg
      var msg = {
        rlf : {
          id : that.id,
          name : that.name,
          command : that.command,
          working_directory : that.wd,
          running : that.running
        },
        args : that.args
      };

      return msg;
    };

    // Used to easily build the service request
    this.buildStopRequest = function(){
      // Mimic remote_launch/RemoteLaunchFile.msg + argus
      var msg = {
        rlf : {
          id : that.id,
          name : that.name,
          command : that.command,
          working_directory : that.wd,
          running : that.running
        },
      };

      return msg;
    };

    // Used by other classes to send a StartLaunchFile service call
    this.start = function() {
      var input = document.getElementById(inputIdPrefix+that.id);
      that.args = (input) ? input.value : '';
      startClient.callService(this.buildStartRequest());
    };

    // Used by other classes to send a StopLaunchFile service call
    this.stop = function() {
      stopClient.callService(this.buildStopRequest());
    };
};