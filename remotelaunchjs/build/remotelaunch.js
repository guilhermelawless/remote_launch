/**
 * @author Guilherme Lawless - guilherme.lawless@gmail.com
 */

var REMOTELAUNCH = REMOTELAUNCH || {
  REVISION : '1.0.0'
};


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

/**
 * @author Guilherme Lawless - guilherme.lawless@gmail.com
 */

/**
 * ListInteract provides a complete EaselJS stage to start and stop launch files
 *
 * @constructor
 * @param options - object with following keys:
 *   * canvas - canvas id to set the stage
 *   * onlyThese (optional) array with the file ids to show. Used to ignore some files
 *   * inputDiv - div to set input text elements
 *   * tooltipsDiv (optional) - DOM div to set tooltip text for each button
 *   * tooltipsList (optional) - array with tooltips
 *   * client - the RemoteLaunch.Client to interface with
 *   * scale (optional) - float to scale the full stage (default 1)
 *   * numberOfColumns (optional) - integer to set how many buttons should be at max per row (default 2)
 */
REMOTELAUNCH.ListInteract = function(options) {
  var that = this;
  options = options || {};
  this.canvas = options.canvas;
  var inputDiv = options.inputDiv;
  var tooltipsDiv = options.tooltipsDiv;
  var list_tooltips = options.tooltipsList;
  var onlyThese = options.onlyThese;
  this.client = options.client;
  var scale = options.scale || 1;
  var numberOfColumns = options.numberOfColumns || 3;

  // Used in for loops
  var index;

  // Used for input text buttons
  var inputIdPrefix = 'buttonInput';

  // Button size configuration
  this.buttonWidth = 150;
  this.buttonHeight = 100;
  this.buttonSpace = 10;

  // Setup the stage
  this.stage = new createjs.Stage(this.canvas);
  this.stage.scaleX = this.stage.scaleY = scale;

  // Enable mouseover events at 20Hz
  this.stage.enableMouseOver(20);

  // Enable touch support
  createjs.Touch.enable(this.stage, false, true);

  // Setup the event listener to client list updates
  this.client.eventEmitter.on('list_update', function(){

    // First time hearing the event, create everything
    if (!that.graphicsCreated) {

      // Create container for all the buttons, anchored at (0,0) of the given canvas
      var buttonContainer = new createjs.Container();

      // Get list of files from client
      var list_client = that.client.list;

      // Find out how much width and height is needed for the canvas
      var numberOfFiles = list_client.length;

      // If we are to ignore any files, that space is not needed. Else consider all files
      var actualFiles = onlyThese ? onlyThese.length : numberOfFiles;

      var numberOfRows = Math.ceil(actualFiles/numberOfColumns);
      // Designed as: button===space===button   -> have to subtract one space at the end
      // Also use extra pixels to account for shadows
      var buttonExtraShadow = 2;
      var canvasWidth = numberOfColumns * (that.buttonWidth + that.buttonSpace) - that.buttonSpace + 2*buttonExtraShadow;
      var canvasHeight = numberOfRows * (that.buttonHeight + that.buttonSpace) - that.buttonSpace + 2*buttonExtraShadow;

      // Set canvas properties
      document.getElementById(that.canvas).width = canvasWidth*scale;
      document.getElementById(that.canvas).height = canvasHeight*scale;

      // Start a loop which constructs shapes with information on the files
      var coords_init = {x:buttonExtraShadow, y:buttonExtraShadow};
      var coords = {x: coords_init.x, y: coords_init.y};
      var buttonsThisRowCounter = 0;
      that.list_interact = [];
      for (index=0; index<numberOfFiles; index++) {

        // Do we want to show this file?
        if(onlyThese){
          if(onlyThese.indexOf(list_client[index].id) === -1){
            continue;
          }
        }

        var tooltip = (list_tooltips) ? list_tooltips[list_client[index].name] : {};

        var file = new REMOTELAUNCH.FileInteract({
          stage : that.stage,
          coords : coords,
          inputDiv : inputDiv,
          tooltipsDiv : tooltipsDiv,
          tooltip: tooltip,
          id : list_client[index].id,
          name : list_client[index].name,
          state : (list_client[index].isRunning() === true) ? 'running' : 'idle',
          width : that.buttonWidth,
          height : that.buttonHeight,
          inputIdPrefix : inputIdPrefix,
        });

        // Listen to 'click' events by the file, calling the clients handle function
        file.eventEmitter.on('click', that.client.handleFileClick);

        // Push to list of FileInteract objects
        that.list_interact.push(file);

        // Add child to container
        buttonContainer.addChild(file.button);

        // Increment button counter for this row
        buttonsThisRowCounter ++;

        // Figure out where to draw next button
        if (buttonsThisRowCounter === numberOfColumns) {
          // Draw in the next row as we have reached the number of buttons per row
          coords.y += (that.buttonHeight + that.buttonSpace);
          coords.x = coords_init.x;

          // Reset button counter
          buttonsThisRowCounter = 0;
        }

        else {
          // Draw in the same row, move only x
          coords.x += that.buttonWidth + that.buttonSpace;
        }
      }

      // Add container to the stage
      that.stage.addChild(buttonContainer);

      // Set flag meaning all graphics are created
      that.graphicsCreated = true;
    }

    else{
        // Only update the running information
        var len = that.list_interact.length;
        for (index=0; index<len; index++) {
          var id = that.list_interact[index].id;
          var state = (that.client.list[id].isRunning() === true) ? 'running' : 'idle';
          that.list_interact[index].setButtonProperties(state);
        }
    }

    function handleFileClick(fileID) {
      // Send another 'click' event, client should hear
      that.eventEmitter.emit('click', fileID);
    }

    that.stage.update();
  });
};


/**
 * FileInteract provides the necessary events and interactions with a single RemoteLaunch.File
 *
 * @constructor
 * @param options - object with following keys:
 *   * stage - the stage where the button will be added. Used for event updates
 *   * coords - desired x, y positions of the button within the container
 *   * inputDiv - div to set input text elements
 *   * tooltipsDiv (optional) - DOM div to set tooltip text for each button
 *   * tooltip (optional) - tooltip text. Must be set if tooltipsDiv is set
 *   * id - this file's id
 *   * name - this file's name
 *   * state - initial state of this file
 *   * width - desired button width
 *   * height - desired button height,
 *   * inputIdPrefix - (optional) prefix for all buttonInput ids (default: 'buttonInput')
 */
REMOTELAUNCH.FileInteract = function(options) {
  var that = this;
  options = options || {};
  this.id = options.id;
  this.state = options.state;
  this.clickedOneTime = false;
  var inputDiv = options.inputDiv;
  var tooltipsDiv = options.tooltipsDiv;
  var tooltip = options.tooltip;
  var coords = options.coords;
  var inputIdPrefix = options.inputIdPrefix || 'buttonInput';

  /*
   * Sets properties for a given state
   * @param stateOpt - string that must be one of following:
   *   * 'running' - the corresponding process is currently running
   *   * 'idle' - the corresponding process is idle
   */
  this.setButtonProperties = function(stateOpt) {

    var state = this.buttonState;
    var background = this.buttonBackground;

    switch (stateOpt) {
      case 'running':
        state.text = 'Running';
        state.font = '16px Arial';
        state.color = '#00CC00';
        break;

      case 'idle':
        if (that.clickedOneTime === false){
          state.text = 'Idle';
          state.font = '16px Arial';
          state.color = '#576357';
        }
        else{
          state.text = 'Stopped';
          state.font = '16px Arial';
          state.color = '#C33627';
        }
        break;
    }
  };

  // Setup event emitter
  this.eventEmitter = new EventEmitter2();

  // Config colors and others
  var backgroundGradientColors = ['#d0d8d0', '#c8c9c8']; //start, end
  var backgroundShadowOffsetDefault = 0;
  var backgroundShadowOffsetClicked = 0;
  var backgroundShadowColorDefault = '#FFFFFF';
  var backgroundShadowColorClicked = '#333333';

  // Create the container and the background
  this.button = new createjs.Container();
  this.button.name = 'button' + options.id;
  this.button.x = coords.x;
  this.button.y = coords.y;
  this.button.stage = options.stage;

  this.buttonBackground = new createjs.Shape();
  this.buttonBackground.name = 'background';
  // Use a linear color fill and draw a round rectangle. Starts at 0,0 since it's a child of the button container
  this.buttonBackground.graphics.beginLinearGradientFill(backgroundGradientColors, [0, 0.8], options.width/2, options.height/2, options.width/2, options.height);
  this.buttonBackground.graphics.drawRoundRect(0, 0, options.width, options.height, 15);
  this.buttonBackground.shadow = new createjs.Shadow(backgroundShadowColorDefault, backgroundShadowOffsetDefault, backgroundShadowOffsetDefault, 2);

  // Create name text
  this.buttonName = new createjs.Text(options.name, 'Bold 18px Arial', '#000000');
  this.buttonName.name = 'name';
  this.buttonName.textAlign = 'center';
  this.buttonName.textBaseline = 'middle';
  this.buttonName.x = options.width/2;
  this.buttonName.y = options.height*1/4;
  this.buttonName.maxWidth = options.width;

  // Create state text
  this.buttonState = new createjs.Text();
  this.buttonState.name = 'state';
  this.buttonState.textAlign = 'center';
  this.buttonState.textBaseline = 'middle';
  this.buttonState.x = options.width/2;
  this.buttonState.y = options.height*2/4;

  // Create input with specific id
  if(inputDiv) {
    this.buttonInput = document.createElement('input');
    this.buttonInput.setAttribute('type','text');
    this.buttonInput.setAttribute('name',inputIdPrefix+that.id);
    this.buttonInput.setAttribute('id',inputIdPrefix+that.id);
    //this.buttonInput.setAttribute('value','');
    this.buttonInput.setAttribute('placeholder','args');
    this.buttonInput.style.top = coords.y+options.height*2/3+'px';
    this.buttonInput.style.left = coords.x+options.width*1/6-2+'px';
    this.buttonInput.style.opacity = '0.4';
    this.buttonInput.style.width = options.width*2/3+'px';
    this.buttonInput.style.position = 'absolute';
    document.getElementById(inputDiv).appendChild(this.buttonInput);
  }
  // Add all children to button
  this.button.addChild(this.buttonBackground, this.buttonName, this.buttonState);

  // Set final properties based on desired state
  this.setButtonProperties(options.state);

  // Set event listeners
  this.button.addEventListener('mousedown', function(){

    // Set shadow levels to a clicked state
    that.buttonBackground.shadow.offsetX = backgroundShadowOffsetClicked;
    that.buttonBackground.shadow.offsetY = backgroundShadowOffsetClicked;
    that.buttonBackground.shadow.color = backgroundShadowColorClicked;

    // Update the stage to show changes
    that.button.stage.update();
  });

  this.button.addEventListener('pressup', function(){

    // Set shadow levels to a default state
    that.buttonBackground.shadow.offsetX = backgroundShadowOffsetDefault;
    that.buttonBackground.shadow.offsetY = backgroundShadowOffsetDefault;
    that.buttonBackground.shadow.color = backgroundShadowColorDefault;

    // Update the stage to show changes
    that.button.stage.update();
  });

  this.button.addEventListener('click', function(){

    // Set flag of having been clicked at least one time
    that.clickedOneTime = true;

    // Emit event, with id as the argument
    that.eventEmitter.emit('click', that.id, options.name);
  });


  // Handle tooltips
  if(tooltipsDiv) {
    this.tooltipsDOM = document.getElementById(tooltipsDiv);
    this.tooltipsSpanDOM = (this.tooltipsDOM.firstElementChild||this.tooltipsDOM.firstChild);

    this.button.addEventListener('mouseover', function(){

      that.tooltipsSpanDOM.textContent = tooltip;
      that.tooltipsDOM.style.display = 'block';
      that.button.stage.update();
    });

    this.button.addEventListener('mouseout', function(){
      
      that.tooltipsDOM.style.display = 'none';
      that.button.stage.update();
    });
  }
};
