# Forensic Learning Record (Deep Inspection): learnsyslab/gym-pybullet-drones

> **Canonical Artifact**: `07_PROJECT_LEARNING/learnsyslab-gym-pybullet-drones-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/learnsyslab/gym-pybullet-drones](https://github.com/learnsyslab/gym-pybullet-drones))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:22:12.056Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `learnsyslab/gym-pybullet-drones`
- **Description**: PyBullet Gymnasium environments for single and multi-agent reinforcement learning of quadcopter control
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2149 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gym_pybullet_drones/__init__.py`
```
from gymnasium.envs.registration import register

register(
    id='ctrl-aviary-v0',
    entry_point='gym_pybullet_drones.envs:CtrlAviary',
)

register(
    id='velocity-aviary-v0',
    entry_point='gym_pybullet_drones.envs:VelocityAviary',
)

register(
    id='hover-aviary-v0',
    entry_point='gym_pybullet_drones.envs:HoverAviary',
)

register(
    id='multihover-aviary-v0',
    entry_point='gym_pybullet_drones.envs:MultiHoverAviary',
)

```

### Core Architecture Module: `gym_pybullet_drones/control/BaseControl.py`
```
import os
import numpy as np
import xml.etree.ElementTree as etxml
from importlib.resources import files

from gym_pybullet_drones.utils.enums import DroneModel

class BaseControl(object):
    """Base class for control.

    Implements `__init__()`, `reset(), and interface `computeControlFromState()`,
    the main method `computeControl()` should be implemented by its subclasses.

    """

    ################################################################################

    def __init__(self,
                 drone_model: DroneModel,
                 g: float=9.8
                 ):
        """Common control classes __init__ method.

        Parameters
        ----------
        drone_model : DroneModel
            The type of drone to control (detailed in an .urdf file in folder `assets`).
        g : float, optional
            The gravitational acceleration in m/s^2.

        """
        #### Set general use constants #############################
        self.DRONE_MODEL = drone_model
        """DroneModel: The type of drone to control."""
        self.GRAVITY = g*self._getURDFParameter('m')
        """float: The gravitational force (M*g) acting on each drone."""
        self.KF = self._getURDFParameter('kf')
        """float: The coefficient converting RPMs into thrust."""
        self.KM = self._getURDFParameter('km')
        """float: The coefficient converting RPMs into torque."""
        self.reset()

    ################################################################################

    def reset(self):
        """Reset the control classes.

        A general use counter is set to zero.

        """
        self.control_counter = 0

    ################################################################################

    def computeControlFromState(self,
                                control_timestep,
                                state,
                                target_pos,
                                target_rpy=np.zeros(3),
                                target_vel=np.zeros(3),
                                target_rpy_rates=np.zeros(3)
                                ):
        """Interface method using `computeControl`.

        It can be used to compute a control action directly from the value of key "state"
        in the `obs` returned by a call to BaseAviary.step().

        Parameters
        ----------
        control_timestep : float
            The time step at which control is computed.
        state : ndarray
            (20,)-shaped array of floats containing the current state of the drone.
        target_pos : ndarray
            (3,1)-shaped array of floats containing the desired position.
        target_rpy : ndarray, optional
            (3,1)-shaped array of floats containing the desired orientation as roll, pitch, yaw.
        target_vel : ndarray, optional
            (3,1)-shaped array of floats containing the desired velocity.
        target_rpy_rates : ndarray, optional
            (3,1)-shaped array of floats containing the desired roll, pitch, and yaw rates.

        """
        return self.computeControl(control_timestep=control_timestep,
                                   cur_pos=state[0:3],
                                   cur_quat=state[3:7],
                                   cur_vel=state[10:13],
                                   cur_ang_vel=state[13:16],
                                   target_pos=target_pos,
                                   target_rpy=target_rpy,
                                   target_vel=target_vel,
                                   target_rpy_rates=target_rpy_rates
                                   )

    ################################################################################

    def computeControl(self,
                       control_timestep,
                       cur_pos,
                       cur_quat,
                       cur_vel,
                       cur_ang_vel,
                       target_pos,
                       target_rpy=np.zeros(3),
                       target_vel=np.zeros(3),
                       target_rpy_rates=np.zeros(3)
                       ):
        """Abstract method to compute the control action for a single drone.

        It must be implemented by each subclass of `BaseControl`.

        Parameters
        ----------
        control_timestep : float
            The time step at which control is computed.
        cur_pos : ndarray
            (3,1)-shaped array of floats containing the current position.
        cur_quat : ndarray
            (4,1)-shaped array of floats containing the current orientation as a quaternion.
        cur_vel : ndarray
            (3,1)-shaped array of floats containing the current velocity.
        cur_ang_vel : ndarray
            (3,1)-shaped array of floats containing the current angular velocity.
        target_pos : ndarray
            (3,1)-shaped array of floats containing the desired position.
        target_rpy : ndarray, optional
            (3,1)-shaped array of floats containing the desired orientation as roll, pitch, yaw.
        target_vel : ndarray, optional
            (3,1)-shaped array of floats containing the desired velocity.
        target_rpy_rates : ndarray, optional
            (3,1)-shaped array of floats containing the desired roll, pitch, and yaw rates.

        """
        raise NotImplementedError

################################################################################

    def setPIDCoefficients(self,
                           p_coeff_pos=None,
                           i_coeff_pos=None,
                           d_coeff_pos=None,
                           p_coeff_att=None,
                           i_coeff_att=None,
                           d_coeff_att=None
                           ):
        """Sets the coefficients of a PID controller.

        This method throws an error message and exist is the coefficients
        were not initialized (e.g. when the controller is not a PID one).

        Parameters
        ----------
        p_coeff_pos : ndarray, optional
            (3,1)-shaped array of floats containing the position control proportional coefficients.
        i_coeff_pos : ndarray, optional
            (3,1)-shaped array of floats containing the position control integral coefficients.
        d_coeff_pos : ndarray, optional
            (3,1)-shaped array of floats containing the position control derivative coefficients.
        p_coeff_att : ndarray, optional
            (3,1)-shaped array of floats containing the attitude control proportional coefficients.
        i_coeff_att : ndarray, optional
            (3,1)-shaped array of floats containing the attitude control integral coefficients.
        d_coeff_att : ndarray, optional
            (3,1)-shaped array of floats containing the attitude control derivative coefficients.

        """
        ATTR_LIST = ['P_COEFF_FOR', 'I_COEFF_FOR', 'D_COEFF_FOR', 'P_COEFF_TOR', 'I_COEFF_TOR', 'D_COEFF_TOR']
        if not all(hasattr(self, attr) for attr in ATTR_LIST):
            print("[ERROR] in BaseControl.setPIDCoefficients(), not all PID coefficients exist as attributes in the instantiated control class.")
            exit()
        else:
            self.P_COEFF_FOR = self.P_COEFF_FOR if p_coeff_pos is None else p_coeff_pos
            self.I_COEFF_FOR = self.I_COEFF_FOR if i_coeff_pos is None else i_coeff_pos
            self.D_COEFF_FOR = self.D_COEFF_FOR if d_coeff_pos is None else d_coeff_pos
            self.P_COEFF_TOR = self.P_COEFF_TOR if p_coeff_att is None else p_coeff_att
            self.I_COEFF_TOR = self.I_COEFF_TOR if i_coeff_att is None else i_coeff_att
            self.D_COEFF_TOR = self.D_COEFF_TOR if d_coeff_att is None else d_coeff_att

    ################################################################################
    
    def _getURDFParameter(self,
                          parameter_name: str
                          ):
        """Reads a par
```

### Core Architecture Module: `gym_pybullet_drones/control/CTBRControl.py`
```
import os
import numpy as np
import xml.etree.ElementTree as etxml
from importlib.resources import files
import socket 
import struct

from transforms3d.quaternions import rotate_vector, qconjugate, mat2quat, qmult
from transforms3d.utils import normalized_vector

from gym_pybullet_drones.utils.enums import DroneModel

class CTBRControl(object):
    """Base class for control.

    Implements `__init__()`, `reset(), and interface `computeControlFromState()`,
    the main method `computeControl()` should be implemented by its subclasses.

    """

    ################################################################################

    def __init__(self,
                 drone_model: DroneModel,
                 g: float=9.8
                 ):
        """Common control classes __init__ method.

        Parameters
        ----------
        drone_model : DroneModel
            The type of drone to control (detailed in an .urdf file in folder `assets`).
        g : float, optional
            The gravitational acceleration in m/s^2.

        """
        #### Set general use constants #############################
        self.DRONE_MODEL = drone_model
        """DroneModel: The type of drone to control."""
        self.GRAVITY = g*self._getURDFParameter('m')
        """float: The gravitational force (M*g) acting on each drone."""
        self.KF = self._getURDFParameter('kf')
        """float: The coefficient converting RPMs into thrust."""
        self.KM = self._getURDFParameter('km')
        """float: The coefficient converting RPMs into torque."""
        
        self.reset()

    ################################################################################

    def reset(self):
        """Reset the control classes.

        A general use counter is set to zero.

        """
        self.control_counter = 0

    ################################################################################

    def computeControlFromState(self,
                                control_timestep,
                                state,
                                target_pos,
                                target_rpy=np.zeros(3),
                                target_vel=np.zeros(3),
                                target_rpy_rates=np.zeros(3)
                                ):
        """Interface method using `computeControl`.

        It can be used to compute a control action directly from the value of key "state"
        in the `obs` returned by a call to BaseAviary.step().

        Parameters
        ----------
        control_timestep : float
            The time step at which control is computed.
        state : ndarray
            (20,)-shaped array of floats containing the current state of the drone.
        target_pos : ndarray
            (3,1)-shaped array of floats containing the desired position.
        target_rpy : ndarray, optional
            (3,1)-shaped array of floats containing the desired orientation as roll, pitch, yaw.
        target_vel : ndarray, optional
            (3,1)-shaped array of floats containing the desired velocity.
        target_rpy_rates : ndarray, optional
            (3,1)-shaped array of floats containing the desired roll, pitch, and yaw rates.
        """

        return self.computeControl(control_timestep=control_timestep,
                                   cur_pos=state[0:3],
                                   cur_quat=np.array([state[6], state[3], state[4], state[5]]),
                                   cur_vel=state[10:13],
                                   cur_ang_vel=state[13:16],
                                   target_pos=target_pos,
                                   target_rpy=target_rpy,
                                   target_vel=target_vel,
                                   target_rpy_rates=target_rpy_rates
                                   )

    ################################################################################

    def computeControl(self,
                       control_timestep,
                       cur_pos,
                       cur_quat,
                       cur_vel,
                       cur_ang_vel,
                       target_pos,
                       target_rpy=np.zeros(3),
                       target_vel=np.zeros(3),
                       target_rpy_rates=np.zeros(3)
                       ):
        """Abstract method to compute the control action for a single drone.

        It must be implemented by each subclass of `BaseControl`.

        Parameters
        ----------
        control_timestep : float
            The time step at which control is computed.
        cur_pos : ndarray
            (3,1)-shaped array of floats containing the current position.
        cur_quat : ndarray
            (4,1)-shaped array of floats containing the current orientation as a quaternion.
        cur_vel : ndarray
            (3,1)-shaped array of floats containing the current velocity.
        cur_ang_vel : ndarray
            (3,1)-shaped array of floats containing the current angular velocity.
        target_pos : ndarray
            (3,1)-shaped array of floats containing the desired position.
        target_rpy : ndarray, optional
            (3,1)-shaped array of floats containing the desired orientation as roll, pitch, yaw.
        target_vel : ndarray, optional
            (3,1)-shaped array of floats containing the desired velocity.
        target_rpy_rates : ndarray, optional
            (3,1)-shaped array of floats containing the desired roll, pitch, and yaw rates.

        """
        assert(cur_pos.shape == (3,)), f"cur_pos {cur_pos.shape}"
        assert(cur_quat.shape == (4,)), f"cur_quat {cur_quat.shape}"
        assert(cur_vel.shape == (3,)), f"cur_vel {cur_vel.shape}"
        assert(cur_ang_vel.shape == (3,)), f"cur_ang_vel {cur_ang_vel.shape}"
        assert(target_pos.shape == (3,)), f"target_pos {target_pos.shape}"
        assert(target_rpy.shape == (3,)), f"target_rpy {target_rpy.shape}"
        assert(target_vel.shape == (3,)), f"target_vel {target_vel.shape}"
        assert(target_rpy_rates.shape == (3,)), f"target_rpy_rates {target_rpy_rates.shape}"

        G = np.array([.0, .0, -9.8])
        K_P = np.array([3., 3., 8.])
        K_D = np.array([2.5, 2.5, 5.])
        K_RATES = np.array([5., 5., 1.])
        P = target_pos - cur_pos
        D = target_vel - cur_vel
        tar_acc = K_P * P + K_D * D - G
        norm_thrust = np.dot(tar_acc, rotate_vector([.0, .0, 1.], cur_quat))
        # Calculate target attitude
        z_body = normalized_vector(tar_acc)
        x_body = normalized_vector(np.cross(np.array([.0, 1., .0]), z_body))
        y_body = normalized_vector(np.cross(z_body, x_body))
        tar_att = mat2quat(np.vstack([x_body, y_body, z_body]).T)
        # Calculate body rates
        q_error = qmult(qconjugate(cur_quat), tar_att)
        body_rates = 2 * K_RATES * q_error[1:]
        if q_error[0] < 0:
            body_rates = -body_rates

        return norm_thrust, *body_rates

################################################################################

    def setPIDCoefficients(self,
                           p_coeff_pos=None,
                           i_coeff_pos=None,
                           d_coeff_pos=None,
                           p_coeff_att=None,
                           i_coeff_att=None,
                           d_coeff_att=None
                           ):
        """Sets the coefficients of a PID controller.

        This method throws an error message and exist is the coefficients
        were not initialized (e.g. when the controller is not a PID one).

        Parameters
        ----------
        p_coeff_pos : ndarray, optional
            (3,1)-shaped array of floats containing the position control proportional coefficients.
        i_coeff_pos : ndarray, optional
            (3,1)-shaped array of floats containing the position control integral coefficients.
        d_coeff_pos : ndarray, opti
```

### Core Architecture Module: `gym_pybullet_drones/control/DSLPIDControl.py`
```
import math
import numpy as np
import pybullet as p
from scipy.spatial.transform import Rotation

from gym_pybullet_drones.control.BaseControl import BaseControl
from gym_pybullet_drones.utils.enums import DroneModel

class DSLPIDControl(BaseControl):
    """PID control class for Crazyflies.

    This is a cascaded position and attitude controller. The ``target_rpy_rates``
    input is interpreted as roll, pitch, and yaw Euler-angle rates in rad/s and
    is used by the derivative term of the attitude PID. It is not a body-rate
    (p, q, r) or ACRO command interface, and ``cur_ang_vel`` is currently unused.

    Based on work conducted at UTIAS' DSL. Contributors: SiQi Zhou, James Xu, 
    Tracy Du, Mario Vukosavljev, Calvin Ngan, and Jingyuan Hou.

    """

    ################################################################################

    def __init__(self,
                 drone_model: DroneModel,
                 g: float=9.8
                 ):
        """Common control classes __init__ method.

        Parameters
        ----------
        drone_model : DroneModel
            The type of drone to control (detailed in an .urdf file in folder `assets`).
        g : float, optional
            The gravitational acceleration in m/s^2.

        """
        super().__init__(drone_model=drone_model, g=g)
        if self.DRONE_MODEL != DroneModel.CF2X and self.DRONE_MODEL != DroneModel.CF2P:
            print("[ERROR] in DSLPIDControl.__init__(), DSLPIDControl requires DroneModel.CF2X or DroneModel.CF2P")
            exit()
        self.P_COEFF_FOR = np.array([.4, .4, 1.25])
        self.I_COEFF_FOR = np.array([.05, .05, .05])
        self.D_COEFF_FOR = np.array([.2, .2, .5])
        self.P_COEFF_TOR = np.array([70000., 70000., 60000.])
        self.I_COEFF_TOR = np.array([.0, .0, 500.])
        self.D_COEFF_TOR = np.array([20000., 20000., 12000.])
        self.PWM2RPM_SCALE = 0.2685
        self.PWM2RPM_CONST = 4070.3
        self.MIN_PWM = 20000
        self.MAX_PWM = 65535
        if self.DRONE_MODEL == DroneModel.CF2X:
            self.MIXER_MATRIX = np.array([ 
                                    [-.5, -.5, -1],
                                    [-.5,  .5,  1],
                                    [.5, .5, -1],
                                    [.5, -.5,  1]
                                    ])
        elif self.DRONE_MODEL == DroneModel.CF2P:
            self.MIXER_MATRIX = np.array([
                                    [0, -1,  -1],
                                    [+1, 0, 1],
                                    [0,  1,  -1],
                                    [-1, 0, 1]
                                    ])
        self.reset()

    ################################################################################

    def reset(self):
        """Resets the control classes.

        The previous step's and integral errors for both position and attitude are set to zero.

        """
        super().reset()
        #### Store the last roll, pitch, and yaw ###################
        self.last_rpy = np.zeros(3)
        #### Initialized PID control variables #####################
        self.last_pos_e = np.zeros(3)
        self.integral_pos_e = np.zeros(3)
        self.last_rpy_e = np.zeros(3)
        self.integral_rpy_e = np.zeros(3)

    ################################################################################
    
    def computeControl(self,
                       control_timestep,
                       cur_pos,
                       cur_quat,
                       cur_vel,
                       cur_ang_vel,
                       target_pos,
                       target_rpy=np.zeros(3),
                       target_vel=np.zeros(3),
                       target_rpy_rates=np.zeros(3)
                       ):
        """Computes the PID control action (as RPMs) for a single drone.

        This methods sequentially calls `_dslPIDPositionControl()` and `_dslPIDAttitudeControl()`.
        Parameter `cur_ang_vel` is unused.

        Parameters
        ----------
        control_timestep : float
            The time step at which control is computed.
        cur_pos : ndarray
            (3,1)-shaped array of floats containing the current position.
        cur_quat : ndarray
            (4,1)-shaped array of floats containing the current orientation as a quaternion.
        cur_vel : ndarray
            (3,1)-shaped array of floats containing the current velocity.
        cur_ang_vel : ndarray
            (3,1)-shaped array of floats containing the current angular velocity.
        target_pos : ndarray
            (3,1)-shaped array of floats containing the desired position.
        target_rpy : ndarray, optional
            (3,1)-shaped array of floats containing the desired orientation as roll, pitch, yaw.
        target_vel : ndarray, optional
            (3,1)-shaped array of floats containing the desired velocity.
        target_rpy_rates : ndarray, optional
            (3,1)-shaped array containing desired roll, pitch, and yaw
            Euler-angle rates in rad/s. These rates are used by the derivative
            term of the attitude PID; they are not body angular rates (p, q, r)
            and do not replace the attitude loop.

        Returns
        -------
        ndarray
            (4,1)-shaped array of integers containing the RPMs to apply to each of the 4 motors.
        ndarray
            (3,1)-shaped array of floats containing the current XYZ position error.
        float
            The current yaw error.

        """
        self.control_counter += 1
        thrust, computed_target_rpy, pos_e = self._dslPIDPositionControl(control_timestep,
                                                                         cur_pos,
                                                                         cur_quat,
                                                                         cur_vel,
                                                                         target_pos,
                                                                         target_rpy,
                                                                         target_vel
                                                                         )
        rpm = self._dslPIDAttitudeControl(control_timestep,
                                          thrust,
                                          cur_quat,
                                          computed_target_rpy,
                                          target_rpy_rates
                                          )
        cur_rpy = p.getEulerFromQuaternion(cur_quat)
        return rpm, pos_e, computed_target_rpy[2] - cur_rpy[2]
    
    ################################################################################

    def _dslPIDPositionControl(self,
                               control_timestep,
                               cur_pos,
                               cur_quat,
                               cur_vel,
                               target_pos,
                               target_rpy,
                               target_vel
                               ):
        """DSL's CF2.x PID position control.

        Parameters
        ----------
        control_timestep : float
            The time step at which control is computed.
        cur_pos : ndarray
            (3,1)-shaped array of floats containing the current position.
        cur_quat : ndarray
            (4,1)-shaped array of floats containing the current orientation as a quaternion.
        cur_vel : ndarray
            (3,1)-shaped array of floats containing the current velocity.
        target_pos : ndarray
            (3,1)-shaped array of floats containing the desired position.
        target_rpy : ndarray
            (3,1)-shaped array of floats containing the desired orientation as roll, pitch, yaw.
        target_vel : ndarray
            (3,1)-shaped array of floats containing the desired velo
```

### Core Architecture Module: `gym_pybullet_drones/control/MRACControl.py`
```
import math
import numpy as np
import pybullet as p
import control as ct
from scipy.spatial.transform import Rotation
from scipy.linalg import solve_lyapunov

from gym_pybullet_drones.control.BaseControl import BaseControl
from gym_pybullet_drones.utils.enums import DroneModel


class MRACControl(BaseControl):
    """Model Reference Adaptive Controller class for Crazyflies.

        Based on the implementation of https://github.com/caoty777/Quadcoptor-Adaptive-Flight-Control
    """

    def __init__(self, drone_model: DroneModel, g: float = 9.8):
        super().__init__(drone_model=drone_model, g=g)
        if self.DRONE_MODEL not in [DroneModel.CF2X, DroneModel.CF2P, DroneModel.RACE]:
            print("[ERROR] MRAC requires DroneModel.CF2X or DroneModel.CF2P or DroneModel.RACE")
            exit()
        self.Ixx = self._getURDFParameter("ixx")
        self.Iyy = self._getURDFParameter("iyy")
        self.Izz = self._getURDFParameter("izz")
        self.J = np.diag([self.Ixx, self.Iyy, self.Izz])
        self.mass = self._getURDFParameter("m")
        self.l = self._getURDFParameter("arm")
        self.g = g
        self.PWM2RPM_SCALE = 0.2685
        self.PWM2RPM_CONST = 4070.3
        self.MIN_PWM = 20000
        self.MAX_PWM = 65535
        self.Ka = self.KF
        self.Km = self.KM

        if self.DRONE_MODEL == DroneModel.CF2X or self.DRONE_MODEL == DroneModel.RACE:
            self.MIXER_MATRIX = np.array([ 
                                    [-.5, -.5, -1],
                                    [-.5,  .5,  1],
                                    [.5, .5, -1],
                                    [.5, -.5,  1]
                                    ])
        elif self.DRONE_MODEL == DroneModel.CF2P:
            self.MIXER_MATRIX = np.array([
                                    [0, -1,  -1],
                                    [+1, 0, 1],
                                    [0,  1,  -1],
                                    [-1, 0, 1]
                                    ])

        self.Kx, self.Kr = self._compute_K()
        self.Xm = np.zeros((12))
        self.reset()

    def _compute_K(self, psi=0):
        """x = x, y, z, phi, theta, psi, x_dot, y_dot, z_dot, p, q, r
            u = [w1^2, w2^2, w3^2, w4^2] or [thrust, tx, ty, tz]
        """
        g = self.g
        m = self.mass
        Ixx = self.Ixx
        Iyy = self.Iyy
        Izz = self.Izz
        l = self.l
        Ka = self.Ka
        Km = self.Km

        a_sub = np.array([[0, 0, 0, g*np.sin(psi), g*np.cos(psi), 0],
                          [0, 0, 0, -g*np.cos(psi), g*np.sin(psi), 0]])
        a_sub = np.vstack((a_sub, np.zeros((4, 6))))
        
        A = np.block([[np.zeros((6,6)), np.eye(6)],
                      [a_sub, np.zeros((6,6))]])
        
        b_sub = np.array([[1/m, 0, 0, 0],
                          [0, 1/Ixx, 0, 0],
                          [0, 0, 1/Iyy, 0],
                          [0, 0, 0, 1/Izz]])    
        # b_sub = np.array([[Ka/m, Ka/m, Ka/m, Ka/m],
        #             [0, -Ka*l/Ixx, 0, Ka*l/Ixx],
        #             [Ka*l/Iyy, 0, -Ka*l/Iyy, 0],
        #             [Km/Izz, -Km/Izz, Km/Izz, -Km/Izz]]) # For direct rpm
        
        B = np.vstack((np.zeros((8, 4)), b_sub))
        Q = np.eye(12)*600
        # Q = np.diag((700, 700, 700, 500, 500, 500, 500, 500, 500, 500, 500, 500))
        # R = np.eye(4)*10
        # K, self.P, _ = ct.lqr(A, B, Q, R)

        desired_poles = -np.linspace(1, 12, 12)
        K = ct.place(A, B, desired_poles)
        self.Kr_ref_gain = np.linalg.pinv(B) @ (A - B @ K)

        self.Am = A - B@K
        self.Bm = np.copy(B)
        self.P = solve_lyapunov(self.Am.T, -Q)

        self.Gamma_x = np.eye(12) * 5e-3
        self.Gamma_r = np.eye(4) * 5e-3

        Kx = -K.T
        Kr = np.eye(4) 
        return Kx, Kr

    def reset(self):
        super().reset()

    def computeControl(self,
                       control_timestep,
                       cur_pos,
                       cur_quat,
                       cur_vel,
                       cur_ang_vel,
                       target_pos,
                       target_rpy=np.zeros(3),
                       target_vel=np.zeros(3),
                       target_rpy_rates=np.zeros(3)):
        
        cur_rpy = np.array(p.getEulerFromQuaternion(cur_quat))
        cur_ang_vel = Rotation.from_euler('XYZ', cur_rpy).inv().apply(cur_ang_vel) # Convert angular velocity to body frame
        
        if self.control_counter == 0:
            self.Xm = np.hstack((cur_pos, cur_rpy, cur_vel, cur_ang_vel)).reshape(12, 1)
        self.control_counter += 1

        r = np.hstack((target_pos, target_rpy, target_vel, target_rpy_rates)).reshape(12, 1)
        rt = -self.Kr_ref_gain @ r

        X_actual = np.hstack((cur_pos, cur_rpy, cur_vel, cur_ang_vel)).reshape(12, 1)
        u = self.Kx.T @ X_actual + self.Kr.T @ rt
        e = X_actual - self.Xm # TODO plot X_actual and Xm
        Kx_dot = -self.Gamma_x @ X_actual @ e.T @ self.P @ self.Bm
        Kr_dot = -self.Gamma_r @ rt @ e.T @ self.P @ self.Bm

        self.Kx += Kx_dot * control_timestep
        self.Kr += Kr_dot * control_timestep

        thrust, tx, ty, tz = u.squeeze()
        thrust = np.maximum(0, thrust)
        target_torques = np.hstack((tx, ty, tz))
        target_torques = np.clip(target_torques, -3200, 3200)

        thrust = (math.sqrt(thrust / (4*self.KF)) - self.PWM2RPM_CONST) / self.PWM2RPM_SCALE
        pwm = thrust + np.dot(self.MIXER_MATRIX, target_torques)
        pwm = np.clip(pwm, self.MIN_PWM, self.MAX_PWM)
        rpm = self.PWM2RPM_SCALE * pwm + self.PWM2RPM_CONST
        
        pos_e = target_pos - cur_pos
        rpy_e = target_rpy - cur_rpy

        Xm_dot = self.Am @ self.Xm + self.Bm @ rt
        self.Xm += Xm_dot*control_timestep

        return rpm, pos_e, rpy_e

```

### Core Architecture Module: `gym_pybullet_drones/envs/BaseAviary.py`
```
import os
from sys import platform
import time
import collections
from datetime import datetime
import xml.etree.ElementTree as etxml
from importlib.resources import files
from PIL import Image
# import pkgutil
# egl = pkgutil.get_loader('eglRenderer')
import numpy as np
import pybullet as p
import pybullet_data
import gymnasium as gym
from gym_pybullet_drones.utils.enums import DroneModel, Physics, ImageType


class BaseAviary(gym.Env):
    """Base class for "drone aviary" Gym environments."""

    # metadata = {'render.modes': ['human']}
    
    ################################################################################

    def __init__(self,
                 drone_model: DroneModel=DroneModel.CF2X,
                 num_drones: int=1,
                 neighbourhood_radius: float=np.inf,
                 initial_xyzs=None,
                 initial_rpys=None,
                 physics: Physics=Physics.PYB,
                 pyb_freq: int = 240,
                 ctrl_freq: int = 240,
                 gui=False,
                 record=False,
                 obstacles=False,
                 user_debug_gui=True,
                 vision_attributes=False,
                 output_folder='results'
                 ):
        """Initialization of a generic aviary environment.

        Parameters
        ----------
        drone_model : DroneModel, optional
            The desired drone type (detailed in an .urdf file in folder `assets`).
        num_drones : int, optional
            The desired number of drones in the aviary.
        neighbourhood_radius : float, optional
            Radius used to compute the drones' adjacency matrix, in meters.
        initial_xyzs: ndarray | None, optional
            (NUM_DRONES, 3)-shaped array containing the initial XYZ position of the drones.
        initial_rpys: ndarray | None, optional
            (NUM_DRONES, 3)-shaped array containing the initial orientations of the drones (in radians).
        physics : Physics, optional
            The desired implementation of PyBullet physics/custom dynamics.
        pyb_freq : int, optional
            The frequency at which PyBullet steps (a multiple of ctrl_freq).
        ctrl_freq : int, optional
            The frequency at which the environment steps.
        gui : bool, optional
            Whether to use PyBullet's GUI.
        record : bool, optional
            Whether to save a video of the simulation.
        obstacles : bool, optional
            Whether to add obstacles to the simulation.
        user_debug_gui : bool, optional
            Whether to draw the drones' axes and the GUI RPMs sliders.
        vision_attributes : bool, optional
            Whether to allocate the attributes needed by vision-based aviary subclasses.

        """
        #### Constants #############################################
        self.G = 9.8
        self.RAD2DEG = 180/np.pi
        self.DEG2RAD = np.pi/180
        self.CTRL_FREQ = ctrl_freq
        self.PYB_FREQ = pyb_freq
        if self.PYB_FREQ % self.CTRL_FREQ != 0:
            raise ValueError('[ERROR] in BaseAviary.__init__(), pyb_freq is not divisible by env_freq.')
        self.PYB_STEPS_PER_CTRL = int(self.PYB_FREQ / self.CTRL_FREQ)
        self.CTRL_TIMESTEP = 1. / self.CTRL_FREQ
        self.PYB_TIMESTEP = 1. / self.PYB_FREQ
        #### Parameters ############################################
        self.NUM_DRONES = num_drones
        self.NEIGHBOURHOOD_RADIUS = neighbourhood_radius
        #### Options ###############################################
        self.DRONE_MODEL = drone_model
        self.GUI = gui
        self.RECORD = record
        self.PHYSICS = physics
        self.OBSTACLES = obstacles
        self.USER_DEBUG = user_debug_gui
        self.URDF = self.DRONE_MODEL.value + ".urdf"
        self.OUTPUT_FOLDER = output_folder
        #### Load the drone properties from the .urdf file #########
        self.M, \
        self.L, \
        self.THRUST2WEIGHT_RATIO, \
        self.J, \
        self.J_INV, \
        self.KF, \
        self.KM, \
        self.COLLISION_H,\
        self.COLLISION_R, \
        self.COLLISION_Z_OFFSET, \
        self.MAX_SPEED_KMH, \
        self.GND_EFF_COEFF, \
        self.PROP_RADIUS, \
        self.DRAG_COEFF, \
        self.DW_COEFF_1, \
        self.DW_COEFF_2, \
        self.DW_COEFF_3 = self._parseURDFParameters()
        print("[INFO] BaseAviary.__init__() loaded parameters from the drone's .urdf:\n[INFO] m {:f}, L {:f},\n[INFO] ixx {:f}, iyy {:f}, izz {:f},\n[INFO] kf {:e}, km {:e},\n[INFO] t2w {:f}, max_speed_kmh {:f},\n[INFO] gnd_eff_coeff {:f}, prop_radius {:f},\n[INFO] drag_xy_coeff {:f}, drag_z_coeff {:f},\n[INFO] dw_coeff_1 {:f}, dw_coeff_2 {:f}, dw_coeff_3 {:f}".format(
            self.M, self.L, self.J[0,0], self.J[1,1], self.J[2,2], self.KF, self.KM, self.THRUST2WEIGHT_RATIO, self.MAX_SPEED_KMH, self.GND_EFF_COEFF, self.PROP_RADIUS, self.DRAG_COEFF[0], self.DRAG_COEFF[2], self.DW_COEFF_1, self.DW_COEFF_2, self.DW_COEFF_3))
        #### Compute constants #####################################
        self.GRAVITY = self.G*self.M
        self.HOVER_RPM = np.sqrt(self.GRAVITY / (4*self.KF))
        self.MAX_RPM = np.sqrt((self.THRUST2WEIGHT_RATIO*self.GRAVITY) / (4*self.KF))
        self.MAX_THRUST = (4*self.KF*self.MAX_RPM**2)
        if self.DRONE_MODEL == DroneModel.CF2X:
            self.MAX_XY_TORQUE = (2*self.L*self.KF*self.MAX_RPM**2)/np.sqrt(2)
        elif self.DRONE_MODEL == DroneModel.CF2P:
            self.MAX_XY_TORQUE = (self.L*self.KF*self.MAX_RPM**2)
        elif self.DRONE_MODEL == DroneModel.RACE:
            self.MAX_XY_TORQUE = (2*self.L*self.KF*self.MAX_RPM**2)/np.sqrt(2)
        self.MAX_Z_TORQUE = (2*self.KM*self.MAX_RPM**2)
        self.GND_EFF_H_CLIP = 0.25 * self.PROP_RADIUS * np.sqrt((15 * self.MAX_RPM**2 * self.KF * self.GND_EFF_COEFF) / self.MAX_THRUST)
        #### Create attributes for vision tasks ####################
        if self.RECORD:
            self.ONBOARD_IMG_PATH = os.path.join(self.OUTPUT_FOLDER, "recording_" + datetime.now().strftime("%m.%d.%Y_%H.%M.%S"))
            os.makedirs(os.path.dirname(self.ONBOARD_IMG_PATH), exist_ok=True)
        self.VISION_ATTR = vision_attributes
        if self.VISION_ATTR:
            self.IMG_RES = np.array([64, 48])
            self.IMG_FRAME_PER_SEC = 24
            self.IMG_CAPTURE_FREQ = int(self.PYB_FREQ/self.IMG_FRAME_PER_SEC)
            self.rgb = np.zeros(((self.NUM_DRONES, self.IMG_RES[1], self.IMG_RES[0], 4)))
            self.dep = np.ones(((self.NUM_DRONES, self.IMG_RES[1], self.IMG_RES[0])))
            self.seg = np.zeros(((self.NUM_DRONES, self.IMG_RES[1], self.IMG_RES[0])))
            if self.IMG_CAPTURE_FREQ%self.PYB_STEPS_PER_CTRL != 0:
                print("[ERROR] in BaseAviary.__init__(), PyBullet and control frequencies incompatible with the desired video capture frame rate ({:f}Hz)".format(self.IMG_FRAME_PER_SEC))
                exit()
            if self.RECORD:
                for i in range(self.NUM_DRONES):
                    os.makedirs(os.path.dirname(self.ONBOARD_IMG_PATH+"/drone_"+str(i)+"/"), exist_ok=True)
        #### Connect to PyBullet ###################################
        if self.GUI:
            #### With debug GUI ########################################
            self.CLIENT = p.connect(p.GUI) # p.connect(p.GUI, options="--opengl2")
            for i in [p.COV_ENABLE_RGB_BUFFER_PREVIEW, p.COV_ENABLE_DEPTH_BUFFER_PREVIEW, p.COV_ENABLE_SEGMENTATION_MARK_PREVIEW]:
                p.configureDebugVisualizer(i, 0, physicsClientId=self.CLIENT)
            p.resetDebugVisualizerCamera(cameraDistance=3,
                                         cameraYaw=-30,
                                         cameraPitch=-30,
                                         cameraTargetPosition=[0, 0, 0],
                                         physicsClientId=self.CLIENT
                                         )
            ret = p.getDebugVi
```

### Core Architecture Module: `gym_pybullet_drones/envs/BaseRLAviary.py`
```
import os
import numpy as np
import pybullet as p
from gymnasium import spaces
from collections import deque

from gym_pybullet_drones.envs.BaseAviary import BaseAviary
from gym_pybullet_drones.utils.enums import DroneModel, Physics, ActionType, ObservationType, ImageType
from gym_pybullet_drones.control.DSLPIDControl import DSLPIDControl

class BaseRLAviary(BaseAviary):
    """Base single and multi-agent environment class for reinforcement learning."""
    
    ################################################################################

    def __init__(self,
                 drone_model: DroneModel=DroneModel.CF2X,
                 num_drones: int=1,
                 neighbourhood_radius: float=np.inf,
                 initial_xyzs=None,
                 initial_rpys=None,
                 physics: Physics=Physics.PYB,
                 pyb_freq: int = 240,
                 ctrl_freq: int = 240,
                 gui=False,
                 record=False,
                 obs: ObservationType=ObservationType.KIN,
                 act: ActionType=ActionType.RPM
                 ):
        """Initialization of a generic single and multi-agent RL environment.

        Attributes `vision_attributes` and `dynamics_attributes` are selected
        based on the choice of `obs` and `act`; `obstacles` is set to True 
        and overridden with landmarks for vision applications; 
        `user_debug_gui` is set to False for performance.

        Parameters
        ----------
        drone_model : DroneModel, optional
            The desired drone type (detailed in an .urdf file in folder `assets`).
        num_drones : int, optional
            The desired number of drones in the aviary.
        neighbourhood_radius : float, optional
            Radius used to compute the drones' adjacency matrix, in meters.
        initial_xyzs: ndarray | None, optional
            (NUM_DRONES, 3)-shaped array containing the initial XYZ position of the drones.
        initial_rpys: ndarray | None, optional
            (NUM_DRONES, 3)-shaped array containing the initial orientations of the drones (in radians).
        physics : Physics, optional
            The desired implementation of PyBullet physics/custom dynamics.
        pyb_freq : int, optional
            The frequency at which PyBullet steps (a multiple of ctrl_freq).
        ctrl_freq : int, optional
            The frequency at which the environment steps.
        gui : bool, optional
            Whether to use PyBullet's GUI.
        record : bool, optional
            Whether to save a video of the simulation.
        obs : ObservationType, optional
            The type of observation space (kinematic information, rgb, depth, or all)
        act : ActionType, optional
            The type of action space (1 or 3D; RPMS, thurst and torques, waypoint or velocity with PID control; etc.)

        """
        #### Create a buffer for the last .5 sec of actions ########
        self.ACTION_BUFFER_SIZE = int(ctrl_freq//2)
        self.action_buffer = deque(maxlen=self.ACTION_BUFFER_SIZE)
        ####
        vision_attributes = True if obs in (ObservationType.RGB, ObservationType.DEP, ObservationType.ALL) else False
        self.OBS_TYPE = obs
        self.ACT_TYPE = act
        #### Create integrated controllers #########################
        if act in [ActionType.PID, ActionType.VEL, ActionType.ONE_D_PID]:
            os.environ['KMP_DUPLICATE_LIB_OK']='True'
            if drone_model in [DroneModel.CF2X, DroneModel.CF2P]:
                self.ctrl = [DSLPIDControl(drone_model=DroneModel.CF2X) for i in range(num_drones)]
            else:
                print("[ERROR] in BaseRLAviary.__init()__, no controller is available for the specified drone_model")
        super().__init__(drone_model=drone_model,
                         num_drones=num_drones,
                         neighbourhood_radius=neighbourhood_radius,
                         initial_xyzs=initial_xyzs,
                         initial_rpys=initial_rpys,
                         physics=physics,
                         pyb_freq=pyb_freq,
                         ctrl_freq=ctrl_freq,
                         gui=gui,
                         record=record, 
                         obstacles=True, # Add obstacles for RGB observations and/or FlyThruGate
                         user_debug_gui=False, # Remove of RPM sliders from all single agent learning aviaries
                         vision_attributes=vision_attributes,
                         )
        #### Set a limit on the maximum target speed ###############
        if act == ActionType.VEL:
            self.SPEED_LIMIT = 0.03 * self.MAX_SPEED_KMH * (1000/3600)

    ################################################################################

    def _addObstacles(self):
        """Add obstacles to the environment.

        Only if the observation is of type RGB, 4 landmarks are added.
        Overrides BaseAviary's method.

        """
        if self.OBS_TYPE == ObservationType.RGB:
            p.loadURDF("block.urdf",
                       [1, 0, .1],
                       p.getQuaternionFromEuler([0, 0, 0]),
                       physicsClientId=self.CLIENT
                       )
            p.loadURDF("cube_small.urdf",
                       [0, 1, .1],
                       p.getQuaternionFromEuler([0, 0, 0]),
                       physicsClientId=self.CLIENT
                       )
            p.loadURDF("duck_vhacd.urdf",
                       [-1, 0, .1],
                       p.getQuaternionFromEuler([0, 0, 0]),
                       physicsClientId=self.CLIENT
                       )
            p.loadURDF("teddy_vhacd.urdf",
                       [0, -1, .1],
                       p.getQuaternionFromEuler([0, 0, 0]),
                       physicsClientId=self.CLIENT
                       )
        else:
            pass

    ################################################################################

    def _actionSpace(self):
        """Returns the action space of the environment.

        Returns
        -------
        spaces.Box
            A Box of size NUM_DRONES x 4, 3, or 1, depending on the action type.

        """
        if self.ACT_TYPE in [ActionType.RPM, ActionType.VEL]:
            size = 4
        elif self.ACT_TYPE==ActionType.PID:
            size = 3
        elif self.ACT_TYPE in [ActionType.ONE_D_RPM, ActionType.ONE_D_PID]:
            size = 1
        else:
            print("[ERROR] in BaseRLAviary._actionSpace()")
            exit()
        act_lower_bound = np.array([-1*np.ones(size) for i in range(self.NUM_DRONES)])
        act_upper_bound = np.array([+1*np.ones(size) for i in range(self.NUM_DRONES)])
        #
        for i in range(self.ACTION_BUFFER_SIZE):
            self.action_buffer.append(np.zeros((self.NUM_DRONES,size)))
        #
        return spaces.Box(low=act_lower_bound, high=act_upper_bound, dtype=np.float32)

    ################################################################################

    def _preprocessAction(self,
                          action
                          ):
        """Pre-processes the action passed to `.step()` into motors' RPMs.

        Parameter `action` is processed differenly for each of the different
        action types: the input to n-th drone, `action[n]` can be of length
        1, 3, or 4, and represent RPMs, desired thrust and torques, or the next
        target position to reach using PID control.

        Parameter `action` is processed differenly for each of the different
        action types: `action` can be of length 1, 3, or 4 and represent 
        RPMs, desired thrust and torques, the next target position to reach 
        using PID control, a desired velocity vector, etc.

        Parameters
        ----------
        action : ndarray
            The input action for each drone, to be translated into RPMs.

        Returns
        -------
        ndarray
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #295** (2026-03-26): **Fix typo found in #294**
  *Symptoms*: as per title

- **Issue #294** (2026-03-26): **Found Bug in BaseControl.py:209 and CTBRControl.py:243**
  *Symptoms*: I have been trying to work with this project for a while now and I stumbled upon a bug that I would like to be fixed. This bug persists in both of the files **BaseControl.py** in line 209 and in **CTBRContro.py** in line 243.  The bug is here: `elif parameter_name in ['arm', 'thrust2weight', 'kf', 'km', 'max_speed_kmh', 'gnd_eff_coeff' 'prop_radius', \`                        ` 'drag_coeff_xy', 'drag_coeff_z', 'dw_coeff_1', 'dw_coeff_2', 'dw_coeff_3']:`  - When looking for parameter name in the list of strings, **there is a comma missing between 'gnd_eff_coeff' and 'prop_radius'** meaning that the two strings are concatenated. Therefore, they will never return anything other than None when the parameter name is looking for them individually.   Please let me know if this is done on purpose or if this is an actual bug :)
  **Post-Mortem & Fix Analysis**:
  > Thanks @visionofdavinci  It looks like a bug/typo, you are welcome to contribute a PR to fix it (otherwise I can do it). But I don’t think the method where that line is is being used to retrieve those 2 parameters, so it should be inconsequential with the current implementation.

- **Issue #267** (2025-09-18): **betaflight zero rpms**
  *Symptoms*: Hi, when I run the example script `examples/beta.py` I get zero rpms.  I added printing to `BetaAviary` like this:  ``` else:     # print("received message: ", data)     _action = np.array(struct.unpack('@ffff', data)).reshape((1,4))     print(_action) ```  And get the following output:  <img width="1365" alt="Image" src="https://github.com/user-attachments/assets/9cf69aab-c235-4936-8405-390a10172e4e" />  Logged z coordinate of every drone looks like this:  ![Image](https://github.com/user-attachments/assets/e43a40b8-0170-4de5-92f6-9f2e41bf4b91)    I use latest commit: 5404871. Thank you in advance
  **Post-Mortem & Fix Analysis**:
  > Thank you for the bug reporting @simplerick  Have you read and tried to read issue https://github.com/utiasDSL/gym-pybullet-drones/issues/241 into the output of `sudo ss -tulpn` (to check the UDP traffic)?

- **Issue #261** (2025-02-11): **Beta.csv inexistant**
  *Symptoms*: Hello, when using the beta code (python3 beta.py --num_drones 2) (I ofc did the ./clone_bfs.sh 2), the code is crashing due to the fact that the file "beta.csv" is missing  in the assets folder. Looking at the code of beta.py, line 105 indeed code is trying to access the beta.csv file. So my question is, where is it supposed to be ? Is it supposed to be generated in some ways ? There is however beta-traj.csv in the assets folder (opened by beta.py line 91)
  **Post-Mortem & Fix Analysis**:
  > yes, sorry for the typo, should be fixed by merge https://github.com/utiasDSL/gym-pybullet-drones/commit/dbfff03103958e495966e8403e023b6d1d7193ab

- **Issue #256** (2025-09-18): **Questions about the crazyflie model and simulation**
  *Symptoms*: Hello,  Thanks for your great work of developing the quadrotor simulatior.  I have several questions about the crazyflie model and simulation.  1. When I check the figure of thr drone in paper and official site of bitcraze, I noticed that the order of motors are different (in the reverse order). When checking the `_physics()` in BaseAviary.py the sign of z_torque is different from paper https://arxiv.org/pdf/1608.05786, I wonder if the rotation direction of motors is different from the official website?  2. I am not familar with the Euler angles in pybullet. I wonder in this simulator, what is the order of rotations axes, is it intrinsic or extrinsic rotation?  3. When I use `dyn` as physics, the drones fell down to underground. Are there bugs in the dynamic? 
  **Post-Mortem & Fix Analysis**:
  > Hello @xchl19,  1. the implementation here is mainly taken by the system identification works mentioned in the URDF files ``` <carlos url="https://arxiv.org/pdf/1608.05786.pdf" /> <julian url="https://www.research-collection.ethz.ch/handle/20.500.11850/214143" /> <mit url="http://groups.csail.mit.edu/robotics-center/public_papers/Landry15.pdf" /> ``` not Bitcraze documentation directly, if you are using a specific firmware, you could indeed have to remap the inputs as it is done in `BetaAviary` and `CFAviary` https://github.com/utiasDSL/gym-pybullet-drones/blob/3d7b12edd4915a27e6cec9f2c0eb4b5479f7735e/gym_pybullet_drones/envs/BetaAviary.py#L258 https://github.com/utiasDSL/gym-pybullet-drones/blob/3d7b12edd4915a27e6cec9f2c0eb4b5479f7735e/gym_pybullet_drones/envs/CFAviary.py#L633  2. see the ["Transforms" section in PyBullet Quick Guide](https://docs.google.com/document/d/10sXEhzFRSnvFcl3XxNGhnD4N2SedqwdAvK3dsihxVUA/edit?tab=t.0#heading=h.y6v0hy52u8fg) for the rotation order
  > Thanks a lot for your reply!  About question 3, I changed `DEFAULT_PHYSICS = Physics("pyb")` in `pid.py` into `DEFAULT_PHYSICS = Physics("dyn")`. 
  > Thanks @xchl19, it seems you are correct and "dyn" is not working as expected [This PR](https://github.com/utiasDSL/gym-pybullet-drones/pull/166) was the most recent change to its implementation but even reverting it does not seem to fix the issue, I'll need to investigate a bit deeper if something about the robot description or bullet has changed

- **Issue #250** (2025-02-11): **Updated eeprom file, checkout to working Betaflight version in clone_bfs.sh and small fix in beta.py**
  *Symptoms*: - Updated eeprom.bin, increasing the time-to-failsafe-delays to max. - Added a git checkout cafe727 line in clone_bfs.sh to clone a version that works. - Fixed small error in beta.py, now pointing to the correct file. 
  **Post-Mortem & Fix Analysis**:
  > Thanks @Honungsburken  This LGTM, could you please add the `git checkout cafe727` fix to the instructions in the README as well and I will merge your PR?

- **Issue #197** (2024-03-24): **Some camera associated issues**
  *Symptoms*: Hello!When i was trying to set --record_video to value true and python informs me there is no such file or dictionary. I was wondering if i got something wrong. ![屏幕截图 2024-03-21 173205](https://github.com/utiasDSL/gym-pybullet-drones/assets/138562578/79bd8450-2e52-44f4-a3a5-4cd0342739b3) 
  **Post-Mortem & Fix Analysis**:
  > @ereshkigal224   thank for noting this, it should work now!

- **Issue #190** (2024-02-10): **Update drag function BaseAviary.py**
  *Symptoms*: Fix issue #189 

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `d01d268b` (2026-08-16)
**Commit Message**: Update to Python 3.12, Ubuntu 24.04, Betaflight SITL Fixes (#316)

* python 3.12 env on ubuntu 24.04

* update action versions

* Fix VTX band letters initializer in SITL build (#313)

* Fix VTX band letters initializer in SITL build

* non-gnome users are people too...

* use gnome terminal if available

* drop cf sitl and rename mrac class

* drop cf sitl and rename mrac class

* tested betaflight example

* format readme

---------

Co-authored-by: Kayra Aytuğ <110812262+kayraaytug@users.noreply.github.com>

**File**: `.github/workflows/test.yml` (modified, +3/-3)
```diff
@@ -14,11 +14,11 @@ jobs:
   run_tests:
     runs-on: ubuntu-latest
     steps:
-    - uses: actions/checkout@v3
+    - uses: actions/checkout@v4
     - name: Set up Python
-      uses: actions/setup-python@v3
+      uses: actions/setup-python@v4
       with:
-        python-version: '3.10'
+        python-version: '3.12'
     - name: Install dependencies
       run: |
         python -m pip install --upgrade pip
```

**File**: `README.md` (modified, +18/-31)
```diff
@@ -7,23 +7,23 @@
 
 # gym-pybullet-drones
 
-This is a minimalist refactoring of the original `gym-pybullet-drones` repository, designed for compatibility with [`gymnasium`](https://github.com/Farama-Foundation/Gymnasium), [`stable-baselines3` 2.0](https://github.com/DLR-RM/stable-baselines3/pull/1327), and [`betaflight`](https://github.com/betaflight/betaflight)/[`crazyflie-firmware`](https://github.com/bitcraze/crazyflie-firmware/) SITL.
+This is a minimalist refactoring of the original `gym-pybullet-drones` repository, designed for compatibility with [`gymnasium`](https://github.com/Farama-Foundation/Gymnasium), [`stable-baselines3` 2.0](https://github.com/DLR-RM/stable-baselines3/pull/1327), and [`betaflight`](https://github.com/betaflight/betaflight) SITL.
 
 > **NEWS**: `gym-pybullet-drones` was featured in [GitHub's Maintainer Spotlight 2026](https://maintainermonth.github.com/academia/gym-pybullet-drones-maintainer-spotlight)
 
-> **NOTE**: if you want to access the original codebase, presented at IROS in 2021, please `git checkout [paper|master]`
+> **NOTE**: if you want to access the original IROS 2021 codebase, please `git checkout [paper|master]`
 
 <img src="gym_pybullet_drones/assets/helix.gif" alt="formation flight" width="325"> <img src="gym_pybullet_drones/assets/helix.png" alt="control info" width="425">
 
 ## Installation
 
-Tested on Intel x64/Ubuntu 22.04 and Apple Silicon/macOS 26.2.
+Tested on Intel x64/Ubuntu 24.04 and Apple Silicon/macOS 26.
 
 ```sh
 git clone https://github.com/learnsyslab/gym-pybullet-drones.git
 cd gym-pybullet-drones/
 
-conda create -n drones python=3.10
+conda create -n drones python=3.12
 conda activate drones
 
 pip3 install -e . # if needed, `sudo apt install build-essential` to install `gcc` and build `pybullet`
@@ -33,12 +33,13 @@ pip3 install -e . # if needed, `sudo apt install build-essential` to install `gc
 
 ## Use
 
-### PID control examples
+### Control examples
 
 ```sh
 cd gym_pybullet_drones/examples/
 python3 pid.py # position and velocity reference
 python3 pid_velocity.py # desired velocity reference
+python3 mrac.py # adaptive controller example
 ```
 
 ### Downwash effect example
@@ -52,10 +53,14 @@ python3 downwash.py
 
 ```sh
 cd gym_pybullet_drones/examples/
-python learn.py # task: single drone hover at z == 1.0
-python learn.py --multiagent true # task: 2-drone hover at z == 1.2 and 0.7
 
+# single agent
+python learn.py # task: single drone hover at z == 1.0
 LATEST_MODEL=$(ls -t results | head -n 1) && python play.py --model_path "results/${LATEST_MODEL}/best_model.zip" # play and visualize the most recent learned policy after training
+
+# multi-agent
+python learn.py --multiagent true # task: 2-drone hover at z == 1.2 and 0.7
+LATEST_MODEL=$(ls -t results | head -n 1) && python play.py --multiagent true --model_path "results/${LATEST_MODEL}/best_model.zip" # play and visualize the most recent learned policy after training
 ```
 
 <img src="gym_pybullet_drones/assets/rl.gif" alt="rl example" width="375"> <img src="gym_pybullet_drones/assets/marl.gif" alt="marl example" width="375">
@@ -71,30 +76,13 @@ pytest tests/
 ### Betaflight SITL example (Ubuntu only)
 
 ```sh
-git clone https://github.com/betaflight/betaflight 
-cd betaflight/
-git checkout cafe727 # `master` branch head at the time of writing (future release 4.5)
-make arm_sdk_install # if needed, `apt install curl``
-make TARGET=SITL # comment out line: https://github.com/betaflight/betaflight/blob/master/src/main/main.c#L52
-cp ~/gym-pybullet-drones/gym_pybullet_drones/assets/eeprom.bin ~/betaflight/ # assuming both gym-pybullet-drones/ and betaflight/ were cloned in ~/
-betaflight/obj/main/betaflight_SITL.elf
-```
-
-In another terminal, run the example
-
-```sh
-conda activate drones
-cd gym_pybullet_drones/examples/
-python3 beta.py --num_drones 1 # check the steps in the file's docstrings to use multiple drones
-```
-
-### `pycffirmware` Python Bindings example (multiplatform, single-dr
```

**File**: `gym_pybullet_drones/assets/clone_bfs.sh` (modified, +4/-2)
```diff
@@ -11,11 +11,11 @@ fi
 # Extract command-line arguments
 desired_max_num_drones="$1"
 
-# Create gitignored directory in gym-pybullet-donres
+# Create gitignored directory in gym-pybullet-drones
 SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
 cd $SCRIPT_DIR
 cd ../../
-mkdir betaflight_sitl/
+mkdir -p betaflight_sitl/
 cd betaflight_sitl/
 
 # Step 1: Clone and open betaflight's source (at the time of writing, branch `master`, future release 4.5)):
@@ -30,6 +30,8 @@ cd temp/
 git checkout cafe727 #latest commit at the time of writing the gym-pybullet-drones Readme
 
 sed -i "s/delayMicroseconds_real(50);/\/\/delayMicroseconds_real(50);/g" ./src/main/main.c
+sed -i "s/\"-ABEFR\"/{ '-', 'A', 'B', 'E', 'F', 'R' }/g" ./src/main/drivers/vtx_table.c
+sed -i "s/^void IOConfigGPIO(IO_t io, ioConfig_t cfg)/void IOHi(IO_t io) { UNUSED(io); }\nvoid IOLo(IO_t io) { UNUSED(io); }\n\nvoid IOConfigGPIO(IO_t io, ioConfig_t cfg)/" ./src/main/target/SITL/sitl.c
 
 # Prepare
 make arm_sdk_install 
```

**File**: `gym_pybullet_drones/control/BaseControl.py` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 import os
 import numpy as np
 import xml.etree.ElementTree as etxml
-import pkg_resources
+from importlib.resources import files
 
 from gym_pybullet_drones.utils.enums import DroneModel
 
@@ -199,7 +199,7 @@ def _getURDFParameter(self,
         """
         #### Get the XML tree of the drone model to control ########
         URDF = self.DRONE_MODEL.value + ".urdf"
-        path = pkg_resources.resource_filename('gym_pybullet_drones', 'assets/'+URDF)
+        path = str(files('gym_pybullet_drones') / 'assets' / URDF)
         URDF_TREE = etxml.parse(path).getroot()
         #### Find and return the desired parameter #################
         if parameter_name == 'm':
```

**File**: `gym_pybullet_drones/control/CTBRControl.py` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 import os
 import numpy as np
 import xml.etree.ElementTree as etxml
-import pkg_resources
+from importlib.resources import files
 import socket 
 import struct
 
@@ -233,7 +233,7 @@ def _getURDFParameter(self,
         """
         #### Get the XML tree of the drone model to control ########
         URDF = self.DRONE_MODEL.value + ".urdf"
-        path = pkg_resources.resource_filename('gym_pybullet_drones', 'assets/'+URDF)
+        path = str(files('gym_pybullet_drones') / 'assets' / URDF)
         URDF_TREE = etxml.parse(path).getroot()
         #### Find and return the desired parameter #################
         if parameter_name == 'm':
```

---

### Incident Patch 2: `e712698a` (2026-07-11)
**Commit Message**: fix: replace 2 bare except clauses with except Exception (#310)

Changed: gym_pybullet_drones/examples/cf.py, beta.py

Co-authored-by: Niki <keloniki%@gmail.com>

**File**: `gym_pybullet_drones/examples/beta.py` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ def run(
                                                     target_pos=target["pos"]+[INIT_XYZ[j][0], INIT_XYZ[j][1], 0],
                                                     target_vel=target["vel"]
                                                     )
-                except:
+                except Exception:
                     break
         
 
```

**File**: `gym_pybullet_drones/examples/cf.py` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ def run(
                 yaw = i*np.pi/delta/2
                 rpy_rate = np.zeros(3)
                 env.sendFullStateCmd(pos, vel, acc, yaw, rpy_rate, t)
-            except:
+            except Exception:
                 break
 
         #### Log the simulation ####################################
```

---

### Incident Patch 3: `0e4f20db` (2026-04-14)
**Commit Message**: fix: initialize RNG with seed in BaseAviary.reset() (#300)

* fix: initialize RNG with seed in BaseAviary.reset()

Call super().reset(seed=seed, options=options) to properly initialize
Gymnasium's seeded random number generator (self.np_random).

Previously, passing a seed to env.reset(seed=42) was silently ignored,
making episodes non-reproducible. This resolves the TODO on line 243.

Also fixes two typos in docstrings.

* feat: add experiment scripts for basic flight, PID hovering, and multi-drone formation

* remove experiment scripts from this PR

These were unintentionally included. Keeping the PR focused on the
seed initialization fix and typo corrections in BaseAviary.

**File**: `gym_pybullet_drones/envs/BaseAviary.py` (modified, +3/-3)
```diff
@@ -227,7 +227,7 @@ def reset(self,
         seed : int, optional
             Random seed.
         options : dict[..], optional
-            Additinonal options, unused
+            Additional options, unused
 
         Returns
         -------
@@ -240,7 +240,7 @@ def reset(self,
 
         """
 
-        # TODO : initialize random number generator with seed
+        super().reset(seed=seed, options=options)
 
         p.resetSimulation(physicsClientId=self.CLIENT)
         #### Housekeeping ##########################################
@@ -282,7 +282,7 @@ def step(self,
             Whether the current episode is truncated, check the specific implementation of `_computeTruncated()`
             in each subclass for its format.
         bool | dict[..]
-            Whether the current episode is trunacted, always false.
+            Whether the current episode is truncated, always false.
         dict[..]
             Additional information as a dictionary, check the specific implementation of `_computeInfo()`
             in each subclass for its format.
```

---

### Incident Patch 4: `bc25d110` (2026-04-02)
**Commit Message**: fix integer division in DSLPIDControl._one23DInterface (#297)

Use // instead of / for DIM-based division so np.repeat receives an
integer repeat count rather than a float, resolving the type error.

**File**: `gym_pybullet_drones/control/DSLPIDControl.py` (modified, +2/-2)
```diff
@@ -277,9 +277,9 @@ def _one23DInterface(self,
 
         """
         DIM = len(np.array(thrust))
-        pwm = np.clip((np.sqrt(np.array(thrust)/(self.KF*(4/DIM)))-self.PWM2RPM_CONST)/self.PWM2RPM_SCALE, self.MIN_PWM, self.MAX_PWM)
+        pwm = np.clip((np.sqrt(np.array(thrust)/(self.KF*(4//DIM)))-self.PWM2RPM_CONST)/self.PWM2RPM_SCALE, self.MIN_PWM, self.MAX_PWM)
         if DIM in [1, 4]:
-            return np.repeat(pwm, 4/DIM)
+            return np.repeat(pwm, 4//DIM)
         elif DIM==2:
             return np.hstack([pwm, np.flip(pwm)])
         else:
```

---

### Incident Patch 5: `82b0fda6` (2026-02-15)
**Commit Message**: fixes

**File**: `README.md` (modified, +9/-9)
```diff
@@ -66,15 +66,6 @@ cd gym-pybullet-drones/
 pytest tests/
 ```
 
-### utiasDSL `pycffirmware` Python Bindings example (multiplatform, single-drone)
-
-Install [`pycffirmware`](https://github.com/utiasDSL/pycffirmware?tab=readme-ov-file#installation) for Ubuntu, macOS, or Windows
-
-```sh
-cd gym_pybullet_drones/examples/
-python3 cff-dsl.py
-```
-
 ### Betaflight SITL example (Ubuntu only)
 
 ```sh
@@ -95,6 +86,15 @@ cd gym_pybullet_drones/examples/
 python3 beta.py --num_drones 1 # check the steps in the file's docstrings to use multiple drones
 ```
 
+### utiasDSL `pycffirmware` Python Bindings example (multiplatform, single-drone)
+
+First, install [`pycffirmware`](https://github.com/utiasDSL/pycffirmware?tab=readme-ov-file#installation) for Ubuntu, macOS, or Windows, then
+
+```sh
+cd gym_pybullet_drones/examples/
+python3 cf.py
+```
+
 ## Citation
 
 If you wish, please cite our [IROS 2021 paper](https://arxiv.org/abs/2103.02142) ([and original codebase](https://github.com/utiasDSL/gym-pybullet-drones/tree/paper)) as
```

---

### Incident Patch 6: `fbcbacaa` (2025-09-19)
**Commit Message**: fix for issue #238

**File**: `gym_pybullet_drones/envs/BaseAviary.py` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ def __init__(self,
         self.DW_COEFF_1, \
         self.DW_COEFF_2, \
         self.DW_COEFF_3 = self._parseURDFParameters()
-        print("[INFO] BaseAviary.__init__() loaded parameters from the drone's .urdf:\n[INFO] m {:f}, L {:f},\n[INFO] ixx {:f}, iyy {:f}, izz {:f},\n[INFO] kf {:f}, km {:f},\n[INFO] t2w {:f}, max_speed_kmh {:f},\n[INFO] gnd_eff_coeff {:f}, prop_radius {:f},\n[INFO] drag_xy_coeff {:f}, drag_z_coeff {:f},\n[INFO] dw_coeff_1 {:f}, dw_coeff_2 {:f}, dw_coeff_3 {:f}".format(
+        print("[INFO] BaseAviary.__init__() loaded parameters from the drone's .urdf:\n[INFO] m {:f}, L {:f},\n[INFO] ixx {:f}, iyy {:f}, izz {:f},\n[INFO] kf {:e}, km {:e},\n[INFO] t2w {:f}, max_speed_kmh {:f},\n[INFO] gnd_eff_coeff {:f}, prop_radius {:f},\n[INFO] drag_xy_coeff {:f}, drag_z_coeff {:f},\n[INFO] dw_coeff_1 {:f}, dw_coeff_2 {:f}, dw_coeff_3 {:f}".format(
             self.M, self.L, self.J[0,0], self.J[1,1], self.J[2,2], self.KF, self.KM, self.THRUST2WEIGHT_RATIO, self.MAX_SPEED_KMH, self.GND_EFF_COEFF, self.PROP_RADIUS, self.DRAG_COEFF[0], self.DRAG_COEFF[2], self.DW_COEFF_1, self.DW_COEFF_2, self.DW_COEFF_3))
         #### Compute constants #####################################
         self.GRAVITY = self.G*self.M
```

---

### Incident Patch 7: `82b8892b` (2025-08-30)
**Commit Message**: fix for issue #256

**File**: `gym_pybullet_drones/envs/BaseAviary.py` (modified, +4/-1)
```diff
@@ -843,9 +843,12 @@ def _dynamics(self,
         if self.DRONE_MODEL == DroneModel.RACE:
             z_torques = -z_torques
         z_torque = (-z_torques[0] + z_torques[1] - z_torques[2] + z_torques[3])
-        if self.DRONE_MODEL==DroneModel.CF2X or self.DRONE_MODEL==DroneModel.RACE:
+        if self.DRONE_MODEL==DroneModel.RACE:
             x_torque = (forces[0] + forces[1] - forces[2] - forces[3]) * (self.L/np.sqrt(2))
             y_torque = (- forces[0] + forces[1] + forces[2] - forces[3]) * (self.L/np.sqrt(2))
+        elif self.DRONE_MODEL==DroneModel.CF2X:
+            x_torque = - (forces[0] + forces[1] - forces[2] - forces[3]) * (self.L/np.sqrt(2))
+            y_torque = (- forces[0] + forces[1] + forces[2] - forces[3]) * (self.L/np.sqrt(2))
         elif self.DRONE_MODEL==DroneModel.CF2P:
             x_torque = (forces[1] - forces[3]) * self.L
             y_torque = (-forces[0] + forces[2]) * self.L
```

---

### Incident Patch 8: `8fc8589c` (2024-12-12)
**Commit Message**: Updated eeprom file, checkout to working Betaflight version to clone_bfs.sh and small fix in beta.py

**File**: `gym_pybullet_drones/assets/clone_bfs.sh` (modified, +3/-0)
```diff
@@ -26,6 +26,9 @@ git clone https://github.com/betaflight/betaflight temp/
 # (https://github.com/betaflight/betaflight/blob/master/src/main/main.c#L52) 
 # from Betaflight's `SIMULATOR_BUILD`
 cd temp/
+
+git checkout cafe727 #latest commit at the time of writing the gym-pybullet-drones Readme
+
 sed -i "s/delayMicroseconds_real(50);/\/\/delayMicroseconds_real(50);/g" ./src/main/main.c
 
 # Prepare
```

**File**: `gym_pybullet_drones/examples/beta.py` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ def run(
                 float(row["v_z"]),
             ]),
         } for row in csv_reader])
-    with open("../assets/beta.csv", mode='r') as csv_file:
+    with open("../assets/beta-traj.csv", mode='r') as csv_file:
         csv_reader = csv.DictReader(csv_file)
         trajectory2 = iter(reversed([{
             "pos": np.array([
```

---

### Incident Patch 9: `dc71ddca` (2023-12-08)
**Commit Message**: Fixed model choice in the replayed example in learn.py

**File**: `gym_pybullet_drones/examples/learn.py` (modified, +5/-4)
```diff
@@ -90,7 +90,7 @@ def run(multiagent=DEFAULT_MA, output_folder=DEFAULT_OUTPUT_FOLDER, gui=DEFAULT_
                 log_interval=100)
 
     #### Save the model ########################################
-    model.save(filename+'/success_model.zip')
+    model.save(filename+'/final_model.zip')
     print(filename)
 
     #### Print training progression ############################
@@ -104,9 +104,10 @@ def run(multiagent=DEFAULT_MA, output_folder=DEFAULT_OUTPUT_FOLDER, gui=DEFAULT_
     ############################################################
     ############################################################
 
-    if os.path.isfile(filename+'/success_model.zip'):
-        path = filename+'/success_model.zip'
-    elif os.path.isfile(filename+'/best_model.zip'):
+    if local:
+        input("Press Enter to continue...")
+
+    if os.path.isfile(filename+'/best_model.zip'):
         path = filename+'/best_model.zip'
     else:
         print("[ERROR]: no model under the specified path", filename)
```

---

### Incident Patch 10: `899d7b34` (2023-11-26)
**Commit Message**: Multi hover example trained, other fixes

**File**: `README.md` (modified, +13/-4)
```diff
@@ -24,18 +24,27 @@ pip3 install -e . # if needed, `sudo apt install build-essential` to install `gc
 
 ## Use
 
-### PID position control example
+### PID control examples
 
 ```sh
 cd gym_pybullet_drones/examples/
-python3 pid.py
+python3 pid.py # position and velocity reference
+python3 pid_velocity.py # desired velocity reference
 ```
 
-### Stable-baselines3 PPO RL example
+### Downwash efect examples
 
 ```sh
 cd gym_pybullet_drones/examples/
-python3 learn.py
+python3 downwash.py
+```
+
+### Stable-baselines3 PPO RL examples (3' training)
+
+```sh
+cd gym_pybullet_drones/examples/
+python learn.py # task: single drone hover at z == 1
+python learn.py --multiagent true # task: 2-drone hover at z == 1.2 and 0.7
 ```
 
 ### Betaflight SITL example (Ubuntu only)
```

**File**: `gym_pybullet_drones/__init__.py` (modified, +2/-2)
```diff
@@ -16,6 +16,6 @@
 )
 
 register(
-    id='leaderfollower-aviary-v0',
-    entry_point='gym_pybullet_drones.envs:LeaderFollowerAviary',
+    id='multihover-aviary-v0',
+    entry_point='gym_pybullet_drones.envs:MultiHoverAviary',
 )
```

**File**: `gym_pybullet_drones/assets/clone_bfs.sh` (modified, +2/-4)
```diff
@@ -18,7 +18,7 @@ cd ../../
 mkdir betaflight_sitl/
 cd betaflight_sitl/
 
-# Step 1: Clone and open betaflight's source:
+# Step 1: Clone and open betaflight's source (at the time of writing, branch `master`, future release 4.5)):
 git clone https://github.com/betaflight/betaflight temp/
 
 
@@ -27,8 +27,6 @@ git clone https://github.com/betaflight/betaflight temp/
 # from Betaflight's `SIMULATOR_BUILD`
 cd temp/
 sed -i "s/delayMicroseconds_real(50);/\/\/delayMicroseconds_real(50);/g" ./src/main/main.c
-sed -i "s/ret = udpInit(\&stateLink, NULL, 9003, true);/\/\/ret = udpInit(\&stateLink, NULL, PORT_STATE, true);/g" ./src/main/target/SITL/sitl.c
-sed -i "s/printf(\"start UDP server.../\/\/printf(\"start UDP server.../g" ./src/main/target/SITL/sitl.c
 
 # Prepare
 make arm_sdk_install 
@@ -47,7 +45,7 @@ for ((i = 0; i < desired_max_num_drones; i++)); do
     cp -r temp/ "bf${i}/"
     cd "bf${i}/"
 
-    # Step 3: Change the UDP ports used by each Betaflight SITL instancet
+    # Step 3: Change the UDP ports used by each Betaflight SITL instance
     replacement1="PORT_PWM_RAW    90${i}1"
     sed -i "s/$pattern1/$replacement1/g" ./src/main/target/SITL/sitl.c
     replacement2="PORT_PWM    90${i}2"
```

**File**: `gym_pybullet_drones/envs/MultiHoverAviary.py` (renamed, +11/-7)
```diff
@@ -3,7 +3,7 @@
 from gym_pybullet_drones.envs.BaseRLAviary import BaseRLAviary
 from gym_pybullet_drones.utils.enums import DroneModel, Physics, ActionType, ObservationType
 
-class LeaderFollowerAviary(BaseRLAviary):
+class MultiHoverAviary(BaseRLAviary):
     """Multi-agent RL problem: leader-follower."""
 
     ################################################################################
@@ -54,7 +54,6 @@ def __init__(self,
             The type of action space (1 or 3D; RPMS, thurst and torques, or waypoint with PID control)
 
         """
-        self.TARGET_POS = np.array([0,0,1])
         self.EPISODE_LEN_SEC = 8
         super().__init__(drone_model=drone_model,
                          num_drones=num_drones,
@@ -69,6 +68,8 @@ def __init__(self,
                          obs=obs,
                          act=act
                          )
+        
+        self.TARGET_POS = self.INIT_XYZS + np.array([[0,0,1/(i+1)] for i in range(num_drones)])
 
     ################################################################################
     
@@ -82,9 +83,9 @@ def _computeReward(self):
 
         """
         states = np.array([self._getDroneStateVector(i) for i in range(self.NUM_DRONES)])
-        ret = max(0, 2 - np.linalg.norm(self.TARGET_POS-states[0, 0:3])**4)
-        for i in range(1, self.NUM_DRONES):
-            ret += max(0, 2 - np.linalg.norm(states[i-1, 3]-states[i, 3])**4)
+        ret = 0
+        for i in range(self.NUM_DRONES):
+            ret += max(0, 2 - np.linalg.norm(self.TARGET_POS[i,:]-states[i][0:3])**4)
         return ret
 
     ################################################################################
@@ -98,8 +99,11 @@ def _computeTerminated(self):
             Whether the current episode is done.
 
         """
-        state = self._getDroneStateVector(0)
-        if np.linalg.norm(self.TARGET_POS-state[0:3]) < .001:
+        states = np.array([self._getDroneStateVector(i) for i in range(self.NUM_DRONES)])
+        dist = 0
+        for i in range(self.NUM_DRONES):
+            dist += np.linalg.norm(self.TARGET_POS[i,:]-states[i][0:3])
+        if dist < .0001:
             return True
         else:
             return False
```

**File**: `gym_pybullet_drones/envs/__init__.py` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 from gym_pybullet_drones.envs.BetaAviary import BetaAviary
 from gym_pybullet_drones.envs.CtrlAviary import CtrlAviary
 from gym_pybullet_drones.envs.HoverAviary import HoverAviary
-from gym_pybullet_drones.envs.LeaderFollowerAviary import LeaderFollowerAviary
+from gym_pybullet_drones.envs.MultiHoverAviary import MultiHoverAviary
 from gym_pybullet_drones.envs.VelocityAviary import VelocityAviary
```

#### Recent Merged Pull Requests:
- **PR #317** (closed): Fix underactuated hover training not learning (spawn collision, thrust bug, reward shaping, mixer torque compensation) (@saikrishbalaji)
- **PR #316** (2026-08-16): Update to Python 3.12, Ubuntu 24.04, Betaflight SITL Fixes (@JacopoPan)
- **PR #315** (2026-08-16): docs: clarify DSLPID RPY rate semantics (@suhaslord)
- **PR #314** (closed): Docs: clarify BaseAviary reset/URDF-parsing overwrite behavior for subclasses (@anthonygcao)
- **PR #313** (2026-08-15): Fix VTX band letters initializer in SITL build (@kayraaytug)
- **PR #311** (2026-05-31): Added DEP an ALL observation types (@garrettkatz)
- **PR #310** (2026-07-11): fix: replace 2 bare except clauses with except Exception (@KeloYuan)
- **PR #308** (2026-04-28): Update GitHub Org (@JacopoPan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
