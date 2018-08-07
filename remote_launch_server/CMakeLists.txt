cmake_minimum_required(VERSION 2.8.3)
project(remote_launch_server)

## Find catkin macros and libraries
## if COMPONENTS list like find_package(catkin REQUIRED COMPONENTS xyz)
## is used, also find other catkin packages
find_package(catkin REQUIRED COMPONENTS
  std_msgs
  message_generation
  rospy
  roslaunch
)

## Generate messages in the 'msg' folder
add_message_files(
  FILES
  RemoteLaunchFile.msg
  RemoteLaunchFileArray.msg
)

## Generate services in the 'srv' folder
add_service_files(
  FILES
  StartLaunchFile.srv
  StopLaunchFile.srv
)

## Generate added messages and services with any dependencies listed here
generate_messages(
  DEPENDENCIES
  std_msgs
  ${PROJECT_NAME}
)

###################################
## catkin specific configuration ##
###################################
## The catkin_package macro generates cmake config files for your package
## Declare things to be passed to dependent projects
## INCLUDE_DIRS: uncomment this if you package contains header files
## LIBRARIES: libraries you create in this project that dependent projects also need
## CATKIN_DEPENDS: catkin_packages dependent projects also need
## DEPENDS: system dependencies of this project that dependent projects also need
catkin_package(
#  INCLUDE_DIRS include
#  LIBRARIES remote_launch
#  CATKIN_DEPENDS rospy
#  DEPENDS system_lib
)

## Specify additional locations of header files
## Your package locations should be listed before other locations
# include_directories(include)
include_directories(
  ${catkin_INCLUDE_DIRS}
)


## Mark executable scripts (Python etc.) for installation
## in contrast to setup.py, you can choose the destination
install(PROGRAMS
  src/remotelaunch.py
  src/processhandle.py
  DESTINATION ${CATKIN_PACKAGE_BIN_DESTINATION}
)

# Test launch files
roslaunch_add_file_check(launch)
