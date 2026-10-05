# Forensic Learning Record (Deep Inspection): marlbenchmark/on-policy

> **Canonical Artifact**: `07_PROJECT_LEARNING/marlbenchmark-on-policy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/marlbenchmark/on-policy](https://github.com/marlbenchmark/on-policy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:23:09.769Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `marlbenchmark/on-policy`
- **Description**: This is the official implementation of Multi-Agent PPO (MAPPO).
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2110 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `onpolicy/__init__.py`
```
from onpolicy import algorithms, envs, runner, scripts, utils, config


__version__ = "0.1.0"

__all__ = [
    "algorithms",
    "envs",
    "runner",
    "scripts",
    "utils",
    "config",
]
```

### Core Architecture Module: `onpolicy/algorithms/happo/happo_trainer.py`
```
import numpy as np
import torch
import torch.nn as nn
from onpolicy.utils.util import get_gard_norm, huber_loss, mse_loss
from onpolicy.algorithms.utils.popart_hatrpo import PopArt
from onpolicy.algorithms.utils.util import check
from onpolicy.utils.valuenorm import ValueNorm

class HAPPO():
    """
    Trainer class for HAPPO to update policies.
    :param args: (argparse.Namespace) arguments containing relevant model, policy, and env information.
    :param policy: (HAPPO_Policy) policy to update.
    :param device: (torch.device) specifies the device to run on (cpu/gpu).
    """
    def __init__(self,
                 args,
                 policy,
                 device=torch.device("cpu")):

        self.device = device
        self.tpdv = dict(dtype=torch.float32, device=device)
        self.policy = policy

        self.clip_param = args.clip_param
        self.ppo_epoch = args.ppo_epoch
        self.num_mini_batch = args.num_mini_batch
        self.data_chunk_length = args.data_chunk_length
        self.value_loss_coef = args.value_loss_coef
        self.entropy_coef = args.entropy_coef
        self.max_grad_norm = args.max_grad_norm       
        self.huber_delta = args.huber_delta

        self._use_recurrent_policy = args.use_recurrent_policy
        self._use_naive_recurrent = args.use_naive_recurrent_policy
        self._use_max_grad_norm = args.use_max_grad_norm
        self._use_clipped_value_loss = args.use_clipped_value_loss
        self._use_huber_loss = args.use_huber_loss
        self._use_popart = args.use_popart
        self._use_valuenorm = args.use_valuenorm
        self._use_value_active_masks = args.use_value_active_masks
        self._use_policy_active_masks = args.use_policy_active_masks

        if self._use_popart:
            self.value_normalizer = PopArt(1, device=self.device)
        elif self._use_valuenorm:
            self.value_normalizer = ValueNorm(1, device = self.device)
        else:
            self.value_normalizer = None

    def cal_value_loss(self, values, value_preds_batch, return_batch, active_masks_batch):
        """
        Calculate value function loss.
        :param values: (torch.Tensor) value function predictions.
        :param value_preds_batch: (torch.Tensor) "old" value  predictions from data batch (used for value clip loss)
        :param return_batch: (torch.Tensor) reward to go returns.
        :param active_masks_batch: (torch.Tensor) denotes if agent is active or dead at a given timesep.

        :return value_loss: (torch.Tensor) value function loss.
        """
        if self._use_popart or self._use_valuenorm:
            value_pred_clipped = value_preds_batch + (values - value_preds_batch).clamp(-self.clip_param,
                                                                                        self.clip_param)
            error_clipped = self.value_normalizer.normalize(return_batch) - value_pred_clipped
            error_original = self.value_normalizer.normalize(return_batch) - values
        else:
            value_pred_clipped = value_preds_batch + (values - value_preds_batch).clamp(-self.clip_param,
                                                                                        self.clip_param)
            error_clipped = return_batch - value_pred_clipped
            error_original = return_batch - values

        if self._use_huber_loss:
            value_loss_clipped = huber_loss(error_clipped, self.huber_delta)
            value_loss_original = huber_loss(error_original, self.huber_delta)
        else:
            value_loss_clipped = mse_loss(error_clipped)
            value_loss_original = mse_loss(error_original)

        if self._use_clipped_value_loss:
            value_loss = torch.max(value_loss_original, value_loss_clipped)
        else:
            value_loss = value_loss_original

        if self._use_value_active_masks:
            value_loss = (value_loss * active_masks_batch).sum() / active_masks_batch.sum()
        else:
            value_loss = value_loss.mean()

        return value_loss

    def ppo_update(self, sample, update_actor=True):
        """
        Update actor and critic networks.
        :param sample: (Tuple) contains data batch with which to update networks.
        :update_actor: (bool) whether to update actor network.

        :return value_loss: (torch.Tensor) value function loss.
        :return critic_grad_norm: (torch.Tensor) gradient norm from critic update.
        ;return policy_loss: (torch.Tensor) actor(policy) loss value.
        :return dist_entropy: (torch.Tensor) action entropies.
        :return actor_grad_norm: (torch.Tensor) gradient norm from actor update.
        :return imp_weights: (torch.Tensor) importance sampling weights.
        """
        share_obs_batch, obs_batch, rnn_states_batch, rnn_states_critic_batch, actions_batch, \
        value_preds_batch, return_batch, masks_batch, active_masks_batch, old_action_log_probs_batch, \
        adv_targ, available_actions_batch, factor_batch = sample



        old_action_log_probs_batch = check(old_action_log_probs_batch).to(**self.tpdv)
        adv_targ = check(adv_targ).to(**self.tpdv)


        value_preds_batch = check(value_preds_batch).to(**self.tpdv)
        return_batch = check(return_batch).to(**self.tpdv)


        active_masks_batch = check(active_masks_batch).to(**self.tpdv)

        factor_batch = check(factor_batch).to(**self.tpdv)
        # Reshape to do in a single forward pass for all steps
        values, action_log_probs, dist_entropy = self.policy.evaluate_actions(share_obs_batch,
                                                                              obs_batch, 
                                                                              rnn_states_batch, 
                                                                              rnn_states_critic_batch, 
                                                                              actions_batch, 
                                                                              masks_batch, 
                                                                              available_actions_batch,
                                                                              active_masks_batch)
        # actor update
        imp_weights = torch.prod(torch.exp(action_log_probs - old_action_log_probs_batch),dim=-1,keepdim=True)

        surr1 = imp_weights * adv_targ
        surr2 = torch.clamp(imp_weights, 1.0 - self.clip_param, 1.0 + self.clip_param) * adv_targ

        if self._use_policy_active_masks:
            policy_action_loss = (-torch.sum(factor_batch * torch.min(surr1, surr2),
                                             dim=-1,
                                             keepdim=True) * active_masks_batch).sum() / active_masks_batch.sum()
        else:
            policy_action_loss = -torch.sum(factor_batch * torch.min(surr1, surr2), dim=-1, keepdim=True).mean()

        policy_loss = policy_action_loss

        self.policy.actor_optimizer.zero_grad()

        if update_actor:
            (policy_loss - dist_entropy * self.entropy_coef).backward()

        if self._use_max_grad_norm:
            actor_grad_norm = nn.utils.clip_grad_norm_(self.policy.actor.parameters(), self.max_grad_norm)
        else:
            actor_grad_norm = get_gard_norm(self.policy.actor.parameters())

        self.policy.actor_optimizer.step()

        value_loss = self.cal_value_loss(values, value_preds_batch, return_batch, active_masks_batch)

        self.policy.critic_optimizer.zero_grad()

        (value_loss * self.value_loss_coef).backward()

        if self._use_max_grad_norm:
            critic_grad_norm = nn.utils.clip_grad_norm_(self.policy.critic.parameters(), self.max_grad_norm)
        else:
            critic_grad_norm = get_gard_norm(self.policy.critic.parameters())

        self.policy.critic_optimizer.step()

        return value_loss, critic_grad_norm, policy_loss, dist_entrop
```

### Core Architecture Module: `onpolicy/algorithms/happo/policy.py`
```
import torch
from onpolicy.algorithms.r_mappo.algorithm.r_actor_critic import R_Actor, R_Critic
from onpolicy.utils.util import update_linear_schedule

class HAPPO_Policy:
    """
    HAPPO Policy  class. Wraps actor and critic networks to compute actions and value function predictions.

    :param args: (argparse.Namespace) arguments containing relevant model and policy information.
    :param obs_space: (gym.Space) observation space.
    :param cent_obs_space: (gym.Space) value function input space (centralized input for HAPPO, decentralized for IPPO).
    :param action_space: (gym.Space) action space.
    :param device: (torch.device) specifies the device to run on (cpu/gpu).
    """

    def __init__(self, args, obs_space, cent_obs_space, act_space, device=torch.device("cpu")):
        self.args=args
        self.device = device
        self.lr = args.lr
        self.critic_lr = args.critic_lr
        self.opti_eps = args.opti_eps
        self.weight_decay = args.weight_decay

        self.obs_space = obs_space
        self.share_obs_space = cent_obs_space
        self.act_space = act_space

        self.actor = R_Actor(args, self.obs_space, self.act_space, self.device)

        ######################################Please Note#########################################
        #####   We create one critic for each agent, but they are trained with same data     #####
        #####   and using same update setting. Therefore they have the same parameter,       #####
        #####   you can regard them as the same critic.                                      #####
        ##########################################################################################
        self.critic = R_Critic(args, self.share_obs_space, self.device)

        self.actor_optimizer = torch.optim.Adam(self.actor.parameters(),
                                                lr=self.lr, eps=self.opti_eps,
                                                weight_decay=self.weight_decay)
        self.critic_optimizer = torch.optim.Adam(self.critic.parameters(),
                                                 lr=self.critic_lr,
                                                 eps=self.opti_eps,
                                                 weight_decay=self.weight_decay)

    def lr_decay(self, episode, episodes):
        """
        Decay the actor and critic learning rates.
        :param episode: (int) current training episode.
        :param episodes: (int) total number of training episodes.
        """
        update_linear_schedule(self.actor_optimizer, episode, episodes, self.lr)
        update_linear_schedule(self.critic_optimizer, episode, episodes, self.critic_lr)

    def get_actions(self, cent_obs, obs, rnn_states_actor, rnn_states_critic, masks, available_actions=None,
                    deterministic=False):
        """
        Compute actions and value function predictions for the given inputs.
        :param cent_obs (np.ndarray): centralized input to the critic.
        :param obs (np.ndarray): local agent inputs to the actor.
        :param rnn_states_actor: (np.ndarray) if actor is RNN, RNN states for actor.
        :param rnn_states_critic: (np.ndarray) if critic is RNN, RNN states for critic.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.
        :param available_actions: (np.ndarray) denotes which actions are available to agent
                                  (if None, all actions available)
        :param deterministic: (bool) whether the action should be mode of distribution or should be sampled.

        :return values: (torch.Tensor) value function predictions.
        :return actions: (torch.Tensor) actions to take.
        :return action_log_probs: (torch.Tensor) log probabilities of chosen actions.
        :return rnn_states_actor: (torch.Tensor) updated actor network RNN states.
        :return rnn_states_critic: (torch.Tensor) updated critic network RNN states.
        """
        actions, action_log_probs, rnn_states_actor = self.actor(obs,
                                                                 rnn_states_actor,
                                                                 masks,
                                                                 available_actions,
                                                                 deterministic)

        values, rnn_states_critic = self.critic(cent_obs, rnn_states_critic, masks)
        return values, actions, action_log_probs, rnn_states_actor, rnn_states_critic

    def get_values(self, cent_obs, rnn_states_critic, masks):
        """
        Get value function predictions.
        :param cent_obs (np.ndarray): centralized input to the critic.
        :param rnn_states_critic: (np.ndarray) if critic is RNN, RNN states for critic.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.

        :return values: (torch.Tensor) value function predictions.
        """
        values, _ = self.critic(cent_obs, rnn_states_critic, masks)
        return values

    def evaluate_actions(self, cent_obs, obs, rnn_states_actor, rnn_states_critic, action, masks,
                         available_actions=None, active_masks=None):
        """
        Get action logprobs / entropy and value function predictions for actor update.
        :param cent_obs (np.ndarray): centralized input to the critic.
        :param obs (np.ndarray): local agent inputs to the actor.
        :param rnn_states_actor: (np.ndarray) if actor is RNN, RNN states for actor.
        :param rnn_states_critic: (np.ndarray) if critic is RNN, RNN states for critic.
        :param action: (np.ndarray) actions whose log probabilites and entropy to compute.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.
        :param available_actions: (np.ndarray) denotes which actions are available to agent
                                  (if None, all actions available)
        :param active_masks: (torch.Tensor) denotes whether an agent is active or dead.

        :return values: (torch.Tensor) value function predictions.
        :return action_log_probs: (torch.Tensor) log probabilities of the input actions.
        :return dist_entropy: (torch.Tensor) action distribution entropy for the given inputs.
        """

        action_log_probs, dist_entropy = self.actor.evaluate_actions(obs,
                                                                rnn_states_actor,
                                                                action,
                                                                masks,
                                                                available_actions,
                                                                active_masks)

        values, _ = self.critic(cent_obs, rnn_states_critic, masks)
        return values, action_log_probs, dist_entropy


    def act(self, obs, rnn_states_actor, masks, available_actions=None, deterministic=False):
        """
        Compute actions using the given inputs.
        :param obs (np.ndarray): local agent inputs to the actor.
        :param rnn_states_actor: (np.ndarray) if actor is RNN, RNN states for actor.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.
        :param available_actions: (np.ndarray) denotes which actions are available to agent
                                  (if None, all actions available)
        :param deterministic: (bool) whether the action should be mode of distribution or should be sampled.
        """
        actions, _, rnn_states_actor = self.actor(obs, rnn_states_actor, masks, available_actions, deterministic)
        return actions, rnn_states_actor

```

### Core Architecture Module: `onpolicy/algorithms/hatrpo/hatrpo_trainer.py`
```
import numpy as np
import torch
import torch.nn as nn
from onpolicy.utils.util import get_gard_norm, huber_loss, mse_loss
from onpolicy.algorithms.utils.popart_hatrpo import PopArt
from onpolicy.algorithms.utils.util import check
from onpolicy.utils.valuenorm import ValueNorm
from onpolicy.algorithms.r_mappo.algorithm.r_actor_critic import R_Actor

class HATRPO():
    """
    Trainer class for MATRPO to update policies.
    :param args: (argparse.Namespace) arguments containing relevant model, policy, and env information.
    :param policy: (HATRPO_Policy) policy to update.
    :param device: (torch.device) specifies the device to run on (cpu/gpu).
    """
    def __init__(self,
                 args,
                 policy,
                 device=torch.device("cpu")):

        self.device = device
        self.tpdv = dict(dtype=torch.float32, device=device)
        self.policy = policy

        self.clip_param = args.clip_param
        self.num_mini_batch = args.num_mini_batch
        self.data_chunk_length = args.data_chunk_length
        self.value_loss_coef = args.value_loss_coef
        self.entropy_coef = args.entropy_coef
        self.max_grad_norm = args.max_grad_norm       
        self.huber_delta = args.huber_delta

        self.kl_threshold = args.kl_threshold
        self.ls_step = args.ls_step
        self.accept_ratio = args.accept_ratio

        self._use_recurrent_policy = args.use_recurrent_policy
        self._use_naive_recurrent = args.use_naive_recurrent_policy
        self._use_max_grad_norm = args.use_max_grad_norm
        self._use_clipped_value_loss = args.use_clipped_value_loss
        self._use_huber_loss = args.use_huber_loss
        self._use_popart = args.use_popart
        self._use_valuenorm = args.use_valuenorm
        self._use_value_active_masks = args.use_value_active_masks
        self._use_policy_active_masks = args.use_policy_active_masks
        
        if self._use_popart:
            self.value_normalizer = PopArt(1, device=self.device)
        elif self._use_valuenorm:
            self.value_normalizer = ValueNorm(1, device = self.device)
        else:
            self.value_normalizer = None


    def cal_value_loss(self, values, value_preds_batch, return_batch, active_masks_batch):
        """
        Calculate value function loss.
        :param values: (torch.Tensor) value function predictions.
        :param value_preds_batch: (torch.Tensor) "old" value  predictions from data batch (used for value clip loss)
        :param return_batch: (torch.Tensor) reward to go returns.
        :param active_masks_batch: (torch.Tensor) denotes if agent is active or dead at a given timesep.

        :return value_loss: (torch.Tensor) value function loss.
        """
        if self._use_popart or self._use_valuenorm:
            value_pred_clipped = value_preds_batch + (values - value_preds_batch).clamp(-self.clip_param,
                                                                                        self.clip_param)
            error_clipped = self.value_normalizer.normalize(return_batch) - value_pred_clipped
            error_original = self.value_normalizer.normalize(return_batch) - values
        else:
            value_pred_clipped = value_preds_batch + (values - value_preds_batch).clamp(-self.clip_param,
                                                                                        self.clip_param)
            error_clipped = return_batch - value_pred_clipped
            error_original = return_batch - values

        if self._use_huber_loss:
            value_loss_clipped = huber_loss(error_clipped, self.huber_delta)
            value_loss_original = huber_loss(error_original, self.huber_delta)
        else:
            value_loss_clipped = mse_loss(error_clipped)
            value_loss_original = mse_loss(error_original)

        if self._use_clipped_value_loss:
            value_loss = torch.max(value_loss_original, value_loss_clipped)
        else:
            value_loss = value_loss_original

        if self._use_value_active_masks:
            value_loss = (value_loss * active_masks_batch).sum() / active_masks_batch.sum()
        else:
            value_loss = value_loss.mean()

        return value_loss

    def flat_grad(self, grads):
        grad_flatten = []
        for grad in grads:
            if grad is None:
                continue
            grad_flatten.append(grad.view(-1))
        grad_flatten = torch.cat(grad_flatten)
        return grad_flatten

    def flat_hessian(self, hessians):
        hessians_flatten = []
        for hessian in hessians:
            if hessian is None:
                continue
            hessians_flatten.append(hessian.contiguous().view(-1))
        hessians_flatten = torch.cat(hessians_flatten).data
        return hessians_flatten

    def flat_params(self, model):
        params = []
        for param in model.parameters():
            params.append(param.data.view(-1))
        params_flatten = torch.cat(params)
        return params_flatten

    def update_model(self, model, new_params):
        index = 0
        for params in model.parameters():
            params_length = len(params.view(-1))
            new_param = new_params[index: index + params_length]
            new_param = new_param.view(params.size())
            params.data.copy_(new_param)
            index += params_length

    def kl_approx(self, q, p):
        r = torch.exp(p - q)
        kl = r - 1 - p + q
        return kl

    def kl_divergence(self, obs, rnn_states, action, masks, available_actions, active_masks, new_actor, old_actor):
        _, _, mu, std, probs = new_actor.evaluate_actions(obs, rnn_states, action, masks, available_actions, active_masks)
        _, _, mu_old, std_old, probs_old = old_actor.evaluate_actions(obs, rnn_states, action, masks, available_actions, active_masks)
        if mu.grad_fn==None:
            probs_old=probs_old.detach()
            kl= self.kl_approx(probs_old,probs)
        else:
            logstd = torch.log(std)
            mu_old = mu_old.detach()
            std_old = std_old.detach()
            logstd_old = torch.log(std_old)
            # kl divergence between old policy and new policy : D( pi_old || pi_new )
            # pi_old -> mu0, logstd0, std0 / pi_new -> mu, logstd, std
            # be careful of calculating KL-divergence. It is not symmetric metric
            kl =  logstd - logstd_old  + (std_old.pow(2) + (mu_old - mu).pow(2)) / (2.0 * std.pow(2)) - 0.5
        
        if len(kl.shape)>1:
            kl=kl.sum(1, keepdim=True)
        return kl

    # from openai baseline code
    # https://github.com/openai/baselines/blob/master/baselines/common/cg.py
    def conjugate_gradient(self, actor, obs, rnn_states, action, masks, available_actions, active_masks, b, nsteps, residual_tol=1e-10):
        x = torch.zeros(b.size()).to(device=self.device)
        r = b.clone()
        p = b.clone()
        rdotr = torch.dot(r, r)
        for i in range(nsteps):
            _Avp = self.fisher_vector_product(actor, obs, rnn_states, action, masks, available_actions, active_masks, p)
            alpha = rdotr / torch.dot(p, _Avp)
            x += alpha * p
            r -= alpha * _Avp
            new_rdotr = torch.dot(r, r)
            betta = new_rdotr / rdotr
            p = r + betta * p
            rdotr = new_rdotr
            if rdotr < residual_tol:
                break
        return x

    def fisher_vector_product(self, actor, obs, rnn_states, action, masks, available_actions, active_masks, p):
        p.detach()
        kl = self.kl_divergence(obs, rnn_states, action, masks, available_actions, active_masks, new_actor=actor, old_actor=actor)
        kl = kl.mean()
        kl_grad = torch.autograd.grad(kl, actor.parameters(), create_graph=True, allow_unused=True)
        kl_grad = self.flat_grad(kl_grad)  # check kl_grad == 0
        kl_grad_p = (kl_grad * p).sum()
        kl_hessian_p = torch.autograd.grad(kl_grad_p, a
```

### Core Architecture Module: `onpolicy/algorithms/hatrpo/policy.py`
```
import torch
from onpolicy.algorithms.r_mappo.algorithm.r_actor_critic import R_Actor, R_Critic
from onpolicy.utils.util import update_linear_schedule

class HATRPO_Policy:
    """
    HATRPO Policy  class. Wraps actor and critic networks to compute actions and value function predictions.

    :param args: (argparse.Namespace) arguments containing relevant model and policy information.
    :param obs_space: (gym.Space) observation space.
    :param cent_obs_space: (gym.Space) value function input space .
    :param action_space: (gym.Space) action space.
    :param device: (torch.device) specifies the device to run on (cpu/gpu).
    """

    def __init__(self, args, obs_space, cent_obs_space, act_space, device=torch.device("cpu")):
        self.args=args
        self.device = device
        self.lr = args.lr
        self.critic_lr = args.critic_lr
        self.opti_eps = args.opti_eps
        self.weight_decay = args.weight_decay

        self.obs_space = obs_space
        self.share_obs_space = cent_obs_space
        self.act_space = act_space

        self.actor = R_Actor(args, self.obs_space, self.act_space, self.device)

        ######################################Please Note#########################################
        #####   We create one critic for each agent, but they are trained with same data     #####
        #####   and using same update setting. Therefore they have the same parameter,       #####
        #####   you can regard them as the same critic.                                      #####
        ##########################################################################################
        self.critic = R_Critic(args, self.share_obs_space, self.device)

        self.actor_optimizer = torch.optim.Adam(self.actor.parameters(),
                                                lr=self.lr, eps=self.opti_eps,
                                                weight_decay=self.weight_decay)
        self.critic_optimizer = torch.optim.Adam(self.critic.parameters(),
                                                 lr=self.critic_lr,
                                                 eps=self.opti_eps,
                                                 weight_decay=self.weight_decay)

    def lr_decay(self, episode, episodes):
        """
        Decay the actor and critic learning rates.
        :param episode: (int) current training episode.
        :param episodes: (int) total number of training episodes.
        """
        update_linear_schedule(self.actor_optimizer, episode, episodes, self.lr)
        update_linear_schedule(self.critic_optimizer, episode, episodes, self.critic_lr)

    def get_actions(self, cent_obs, obs, rnn_states_actor, rnn_states_critic, masks, available_actions=None,
                    deterministic=False):
        """
        Compute actions and value function predictions for the given inputs.
        :param cent_obs (np.ndarray): centralized input to the critic.
        :param obs (np.ndarray): local agent inputs to the actor.
        :param rnn_states_actor: (np.ndarray) if actor is RNN, RNN states for actor.
        :param rnn_states_critic: (np.ndarray) if critic is RNN, RNN states for critic.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.
        :param available_actions: (np.ndarray) denotes which actions are available to agent
                                  (if None, all actions available)
        :param deterministic: (bool) whether the action should be mode of distribution or should be sampled.

        :return values: (torch.Tensor) value function predictions.
        :return actions: (torch.Tensor) actions to take.
        :return action_log_probs: (torch.Tensor) log probabilities of chosen actions.
        :return rnn_states_actor: (torch.Tensor) updated actor network RNN states.
        :return rnn_states_critic: (torch.Tensor) updated critic network RNN states.
        """
        actions, action_log_probs, rnn_states_actor = self.actor(obs,
                                                                 rnn_states_actor,
                                                                 masks,
                                                                 available_actions,
                                                                 deterministic)

        values, rnn_states_critic = self.critic(cent_obs, rnn_states_critic, masks)
        return values, actions, action_log_probs, rnn_states_actor, rnn_states_critic

    def get_values(self, cent_obs, rnn_states_critic, masks):
        """
        Get value function predictions.
        :param cent_obs (np.ndarray): centralized input to the critic.
        :param rnn_states_critic: (np.ndarray) if critic is RNN, RNN states for critic.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.

        :return values: (torch.Tensor) value function predictions.
        """
        values, _ = self.critic(cent_obs, rnn_states_critic, masks)
        return values

    def evaluate_actions(self, cent_obs, obs, rnn_states_actor, rnn_states_critic, action, masks,
                         available_actions=None, active_masks=None):
        """
        Get action logprobs / entropy and value function predictions for actor update.
        :param cent_obs (np.ndarray): centralized input to the critic.
        :param obs (np.ndarray): local agent inputs to the actor.
        :param rnn_states_actor: (np.ndarray) if actor is RNN, RNN states for actor.
        :param rnn_states_critic: (np.ndarray) if critic is RNN, RNN states for critic.
        :param action: (np.ndarray) actions whose log probabilites and entropy to compute.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.
        :param available_actions: (np.ndarray) denotes which actions are available to agent
                                  (if None, all actions available)
        :param active_masks: (torch.Tensor) denotes whether an agent is active or dead.

        :return values: (torch.Tensor) value function predictions.
        :return action_log_probs: (torch.Tensor) log probabilities of the input actions.
        :return dist_entropy: (torch.Tensor) action distribution entropy for the given inputs.
        """

        action_log_probs, dist_entropy , action_mu, action_std, all_probs= self.actor.evaluate_actions(obs,
                                                                    rnn_states_actor,
                                                                    action,
                                                                    masks,
                                                                    available_actions,
                                                                    active_masks)
        values, _ = self.critic(cent_obs, rnn_states_critic, masks)
        return values, action_log_probs, dist_entropy, action_mu, action_std, all_probs



    def act(self, obs, rnn_states_actor, masks, available_actions=None, deterministic=False):
        """
        Compute actions using the given inputs.
        :param obs (np.ndarray): local agent inputs to the actor.
        :param rnn_states_actor: (np.ndarray) if actor is RNN, RNN states for actor.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.
        :param available_actions: (np.ndarray) denotes which actions are available to agent
                                  (if None, all actions available)
        :param deterministic: (bool) whether the action should be mode of distribution or should be sampled.
        """
        actions, _, rnn_states_actor = self.actor(obs, rnn_states_actor, masks, available_actions, deterministic)
        return actions, rnn_states_actor

```

### Core Architecture Module: `onpolicy/algorithms/mat/algorithm/ma_transformer.py`
```
import torch
import torch.nn as nn
from torch.nn import functional as F
import math
import numpy as np
from torch.distributions import Categorical
from onpolicy.algorithms.utils.util import check, init
from onpolicy.algorithms.utils.transformer_act import discrete_autoregreesive_act
from onpolicy.algorithms.utils.transformer_act import discrete_parallel_act
from onpolicy.algorithms.utils.transformer_act import continuous_autoregreesive_act
from onpolicy.algorithms.utils.transformer_act import continuous_parallel_act

def init_(m, gain=0.01, activate=False):
    if activate:
        gain = nn.init.calculate_gain('relu')
    return init(m, nn.init.orthogonal_, lambda x: nn.init.constant_(x, 0), gain=gain)


class SelfAttention(nn.Module):

    def __init__(self, n_embd, n_head, n_agent, masked=False):
        super(SelfAttention, self).__init__()

        assert n_embd % n_head == 0
        self.masked = masked
        self.n_head = n_head
        # key, query, value projections for all heads
        self.key = init_(nn.Linear(n_embd, n_embd))
        self.query = init_(nn.Linear(n_embd, n_embd))
        self.value = init_(nn.Linear(n_embd, n_embd))
        # output projection
        self.proj = init_(nn.Linear(n_embd, n_embd))
        # if self.masked:
        # causal mask to ensure that attention is only applied to the left in the input sequence
        self.register_buffer("mask", torch.tril(torch.ones(n_agent + 1, n_agent + 1))
                             .view(1, 1, n_agent + 1, n_agent + 1))

        self.att_bp = None

    def forward(self, key, value, query):
        B, L, D = query.size()

        # calculate query, key, values for all heads in batch and move head forward to be the batch dim
        k = self.key(key).view(B, L, self.n_head, D // self.n_head).transpose(1, 2)  # (B, nh, L, hs)
        q = self.query(query).view(B, L, self.n_head, D // self.n_head).transpose(1, 2)  # (B, nh, L, hs)
        v = self.value(value).view(B, L, self.n_head, D // self.n_head).transpose(1, 2)  # (B, nh, L, hs)

        # causal attention: (B, nh, L, hs) x (B, nh, hs, L) -> (B, nh, L, L)
        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(k.size(-1)))

        # self.att_bp = F.softmax(att, dim=-1)

        if self.masked:
            att = att.masked_fill(self.mask[:, :, :L, :L] == 0, float('-inf'))
        att = F.softmax(att, dim=-1)

        y = att @ v  # (B, nh, L, L) x (B, nh, L, hs) -> (B, nh, L, hs)
        y = y.transpose(1, 2).contiguous().view(B, L, D)  # re-assemble all head outputs side by side

        # output projection
        y = self.proj(y)
        return y


class EncodeBlock(nn.Module):
    """ an unassuming Transformer block """

    def __init__(self, n_embd, n_head, n_agent):
        super(EncodeBlock, self).__init__()

        self.ln1 = nn.LayerNorm(n_embd)
        self.ln2 = nn.LayerNorm(n_embd)
        # self.attn = SelfAttention(n_embd, n_head, n_agent, masked=True)
        self.attn = SelfAttention(n_embd, n_head, n_agent, masked=False)
        self.mlp = nn.Sequential(
            init_(nn.Linear(n_embd, 1 * n_embd), activate=True),
            nn.GELU(),
            init_(nn.Linear(1 * n_embd, n_embd))
        )

    def forward(self, x):
        x = self.ln1(x + self.attn(x, x, x))
        x = self.ln2(x + self.mlp(x))
        return x


class DecodeBlock(nn.Module):
    """ an unassuming Transformer block """

    def __init__(self, n_embd, n_head, n_agent):
        super(DecodeBlock, self).__init__()

        self.ln1 = nn.LayerNorm(n_embd)
        self.ln2 = nn.LayerNorm(n_embd)
        self.ln3 = nn.LayerNorm(n_embd)
        self.attn1 = SelfAttention(n_embd, n_head, n_agent, masked=True)
        self.attn2 = SelfAttention(n_embd, n_head, n_agent, masked=True)
        self.mlp = nn.Sequential(
            init_(nn.Linear(n_embd, 1 * n_embd), activate=True),
            nn.GELU(),
            init_(nn.Linear(1 * n_embd, n_embd))
        )

    def forward(self, x, rep_enc):
        x = self.ln1(x + self.attn1(x, x, x))
        x = self.ln2(rep_enc + self.attn2(key=x, value=x, query=rep_enc))
        x = self.ln3(x + self.mlp(x))
        return x


class Encoder(nn.Module):

    def __init__(self, state_dim, obs_dim, n_block, n_embd, n_head, n_agent, encode_state):
        super(Encoder, self).__init__()

        self.state_dim = state_dim
        self.obs_dim = obs_dim
        self.n_embd = n_embd
        self.n_agent = n_agent
        self.encode_state = encode_state
        # self.agent_id_emb = nn.Parameter(torch.zeros(1, n_agent, n_embd))

        self.state_encoder = nn.Sequential(nn.LayerNorm(state_dim),
                                           init_(nn.Linear(state_dim, n_embd), activate=True), nn.GELU())
        self.obs_encoder = nn.Sequential(nn.LayerNorm(obs_dim),
                                         init_(nn.Linear(obs_dim, n_embd), activate=True), nn.GELU())

        self.ln = nn.LayerNorm(n_embd)
        self.blocks = nn.Sequential(*[EncodeBlock(n_embd, n_head, n_agent) for _ in range(n_block)])
        self.head = nn.Sequential(init_(nn.Linear(n_embd, n_embd), activate=True), nn.GELU(), nn.LayerNorm(n_embd),
                                  init_(nn.Linear(n_embd, 1)))

    def forward(self, state, obs):
        # state: (batch, n_agent, state_dim)
        # obs: (batch, n_agent, obs_dim)
        if self.encode_state:
            state_embeddings = self.state_encoder(state)
            x = state_embeddings
        else:
            obs_embeddings = self.obs_encoder(obs)
            x = obs_embeddings

        rep = self.blocks(self.ln(x))
        v_loc = self.head(rep)

        return v_loc, rep


class Decoder(nn.Module):

    def __init__(self, obs_dim, action_dim, n_block, n_embd, n_head, n_agent,
                 action_type='Discrete', dec_actor=False, share_actor=False):
        super(Decoder, self).__init__()

        self.action_dim = action_dim
        self.n_embd = n_embd
        self.dec_actor = dec_actor
        self.share_actor = share_actor
        self.action_type = action_type

        if action_type != 'Discrete':
            log_std = torch.ones(action_dim)
            # log_std = torch.zeros(action_dim)
            self.log_std = torch.nn.Parameter(log_std)
            # self.log_std = torch.nn.Parameter(torch.zeros(action_dim))

        if self.dec_actor:
            if self.share_actor:
                print("mac_dec!!!!!")
                self.mlp = nn.Sequential(nn.LayerNorm(obs_dim),
                                         init_(nn.Linear(obs_dim, n_embd), activate=True), nn.GELU(), nn.LayerNorm(n_embd),
                                         init_(nn.Linear(n_embd, n_embd), activate=True), nn.GELU(), nn.LayerNorm(n_embd),
                                         init_(nn.Linear(n_embd, action_dim)))
            else:
                self.mlp = nn.ModuleList()
                for n in range(n_agent):
                    actor = nn.Sequential(nn.LayerNorm(obs_dim),
                                          init_(nn.Linear(obs_dim, n_embd), activate=True), nn.GELU(), nn.LayerNorm(n_embd),
                                          init_(nn.Linear(n_embd, n_embd), activate=True), nn.GELU(), nn.LayerNorm(n_embd),
                                          init_(nn.Linear(n_embd, action_dim)))
                    self.mlp.append(actor)
        else:
            # self.agent_id_emb = nn.Parameter(torch.zeros(1, n_agent, n_embd))
            if action_type == 'Discrete':
                self.action_encoder = nn.Sequential(init_(nn.Linear(action_dim + 1, n_embd, bias=False), activate=True),
                                                    nn.GELU())
            else:
                self.action_encoder = nn.Sequential(init_(nn.Linear(action_dim, n_embd), activate=True), nn.GELU())
            self.obs_encoder = nn.Sequential(nn.LayerNorm(obs_dim),
                                             init_(nn.Linear(obs_dim, n_embd), activate=True), nn.GELU())
            s
```

### Core Architecture Module: `onpolicy/algorithms/mat/algorithm/transformer_policy.py`
```
import torch
import numpy as np
from onpolicy.utils.util import update_linear_schedule
from onpolicy.utils.util import get_shape_from_obs_space, get_shape_from_act_space
from onpolicy.algorithms.utils.util import check
from onpolicy.algorithms.mat.algorithm.ma_transformer import MultiAgentTransformer


class TransformerPolicy:
    """
    MAPPO Policy  class. Wraps actor and critic networks to compute actions and value function predictions.

    :param args: (argparse.Namespace) arguments containing relevant model and policy information.
    :param obs_space: (gym.Space) observation space.
    :param cent_obs_space: (gym.Space) value function input space (centralized input for MAPPO, decentralized for IPPO).
    :param action_space: (gym.Space) action space.
    :param device: (torch.device) specifies the device to run on (cpu/gpu).
    """

    def __init__(self, args, obs_space, cent_obs_space, act_space, num_agents, device=torch.device("cpu")):
        self.device = device
        self.lr = args.lr
        self.opti_eps = args.opti_eps
        self.weight_decay = args.weight_decay
        self._use_policy_active_masks = args.use_policy_active_masks
        if act_space.__class__.__name__ == 'Box':
            self.action_type = 'Continuous'
        else:
            self.action_type = 'Discrete'

        self.obs_dim = get_shape_from_obs_space(obs_space)[0]
        self.share_obs_dim = get_shape_from_obs_space(cent_obs_space)[0]

        if self.action_type == 'Discrete':
            self.act_dim = act_space.n
            self.act_num = 1
        else:
            print("act high: ", act_space.high)
            self.act_dim = act_space.shape[0]
            self.act_num = self.act_dim

        print("obs_dim: ", self.obs_dim)
        print("share_obs_dim: ", self.share_obs_dim)
        print("act_dim: ", self.act_dim)

        self.num_agents = num_agents
        self.tpdv = dict(dtype=torch.float32, device=device)

        self.transformer = MultiAgentTransformer(self.share_obs_dim, self.obs_dim, self.act_dim, num_agents,
                                                 n_block=args.n_block, n_embd=args.n_embd, n_head=args.n_head,
                                                 encode_state=args.encode_state, device=device,
                                                 action_type=self.action_type, dec_actor=args.dec_actor,
                                                 share_actor=args.share_actor)
        if args.env_name == "hands":
            self.transformer.zero_std()

        # count the volume of parameters of model
        # Total_params = 0
        # Trainable_params = 0
        # NonTrainable_params = 0
        # for param in self.transformer.parameters():
        #     mulValue = np.prod(param.size())
        #     Total_params += mulValue
        #     if param.requires_grad:
        #         Trainable_params += mulValue
        #     else:
        #         NonTrainable_params += mulValue
        # print(f'Total params: {Total_params}')
        # print(f'Trainable params: {Trainable_params}')
        # print(f'Non-trainable params: {NonTrainable_params}')

        self.optimizer = torch.optim.Adam(self.transformer.parameters(),
                                          lr=self.lr, eps=self.opti_eps,
                                          weight_decay=self.weight_decay)

    def lr_decay(self, episode, episodes):
        """
        Decay the actor and critic learning rates.
        :param episode: (int) current training episode.
        :param episodes: (int) total number of training episodes.
        """
        update_linear_schedule(self.optimizer, episode, episodes, self.lr)

    def get_actions(self, cent_obs, obs, rnn_states_actor, rnn_states_critic, masks, available_actions=None,
                    deterministic=False):
        """
        Compute actions and value function predictions for the given inputs.
        :param cent_obs (np.ndarray): centralized input to the critic.
        :param obs (np.ndarray): local agent inputs to the actor.
        :param rnn_states_actor: (np.ndarray) if actor is RNN, RNN states for actor.
        :param rnn_states_critic: (np.ndarray) if critic is RNN, RNN states for critic.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.
        :param available_actions: (np.ndarray) denotes which actions are available to agent
                                  (if None, all actions available)
        :param deterministic: (bool) whether the action should be mode of distribution or should be sampled.

        :return values: (torch.Tensor) value function predictions.
        :return actions: (torch.Tensor) actions to take.
        :return action_log_probs: (torch.Tensor) log probabilities of chosen actions.
        :return rnn_states_actor: (torch.Tensor) updated actor network RNN states.
        :return rnn_states_critic: (torch.Tensor) updated critic network RNN states.
        """
        cent_obs = cent_obs.reshape(-1, self.num_agents, self.share_obs_dim)
        obs = obs.reshape(-1, self.num_agents, self.obs_dim)
        if available_actions is not None:
            available_actions = available_actions.reshape(-1, self.num_agents, self.act_dim)

        actions, action_log_probs, values = self.transformer.get_actions(cent_obs,
                                                                         obs,
                                                                         available_actions,
                                                                         deterministic)

        actions = actions.view(-1, self.act_num)
        action_log_probs = action_log_probs.view(-1, self.act_num)
        values = values.view(-1, 1)

        # unused, just for compatibility
        rnn_states_actor = check(rnn_states_actor).to(**self.tpdv)
        rnn_states_critic = check(rnn_states_critic).to(**self.tpdv)
        return values, actions, action_log_probs, rnn_states_actor, rnn_states_critic

    def get_values(self, cent_obs, obs, rnn_states_critic, masks):
        """
        Get value function predictions.
        :param cent_obs (np.ndarray): centralized input to the critic.
        :param rnn_states_critic: (np.ndarray) if critic is RNN, RNN states for critic.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.

        :return values: (torch.Tensor) value function predictions.
        """

        cent_obs = cent_obs.reshape(-1, self.num_agents, self.share_obs_dim)
        obs = obs.reshape(-1, self.num_agents, self.obs_dim)

        values = self.transformer.get_values(cent_obs, obs)

        values = values.view(-1, 1)

        return values

    def evaluate_actions(self, cent_obs, obs, rnn_states_actor, rnn_states_critic, actions, masks,
                         available_actions=None, active_masks=None):
        """
        Get action logprobs / entropy and value function predictions for actor update.
        :param cent_obs (np.ndarray): centralized input to the critic.
        :param obs (np.ndarray): local agent inputs to the actor.
        :param rnn_states_actor: (np.ndarray) if actor is RNN, RNN states for actor.
        :param rnn_states_critic: (np.ndarray) if critic is RNN, RNN states for critic.
        :param actions: (np.ndarray) actions whose log probabilites and entropy to compute.
        :param masks: (np.ndarray) denotes points at which RNN states should be reset.
        :param available_actions: (np.ndarray) denotes which actions are available to agent
                                  (if None, all actions available)
        :param active_masks: (torch.Tensor) denotes whether an agent is active or dead.

        :return values: (torch.Tensor) value function predictions.
        :return action_log_probs: (torch.Tensor) log probabilities of the input actions.
        :return dist_entropy: (torch.Tensor) action distribution entropy for the given inputs.
        """
        cent_obs = cent
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #136** (2026-07-15): **About Share policy**
  *Symptoms*: when i set share_policy to false i see there are 2 actor.pt and 2 critic.pt for 2 agents.Is this normal?

- **Issue #132** (2026-03-08): **Fix numpy array stacking for heterogeneous observation shapes**
  *Symptoms*: ## Summary This PR fixes issues with numpy array stacking in environment wrapper classes when observations have heterogeneous shapes or types. The changes ensure proper handling of observations that cannot be uniformly stacked.  ## Key Changes - **SubprocVecEnv.step_wait()**: Changed `np.stack(obs)` to `np.array(obs, dtype=object)` to handle observations with varying shapes - **SubprocVecEnv.reset()**: Changed `np.stack(obs)` to `np.array(obs, dtype=object)` for consistent observation handling - **AsyncVecEnv.step_wait()**: Changed `np.stack(obs)` to `np.array(obs, dtype=object)` and refactored result unpacking for clarity - **AsyncVecEnv.reset()**: Changed `np.array(obs)` to `np.array(obs, dtype=object)` for consistency - **SyncVecEnv.step_wait()**: Refactored to explicitly unpack results and use `np.array(obs, dtype=object)` instead of `map(np.array, ...)` - **SyncVecEnv.reset()**: Changed `np.array(obs)` to `np.array(obs, dtype=object)`  ## Implementation Details The core issue is that `np.stack()` requires all input arrays to have compatible shapes, which fails when environments return observations with different dimensions (e.g., variable-length sequences or different image sizes). Using `np.array(..., dtype=object)` creates an object array that can hold heterogeneous observations without attempting to broadcast them to a common shape.  The refactoring in `SyncVecEnv.step_wait()` also improves code clarity by explicitly unpacking the zipped results before c

- **Issue #128** (2025-08-26): **Visualizations**
  *Symptoms*: 

- **Issue #127** (2025-06-29): **nihao**
  *Symptoms*: 你好，为什么我跑的happo的win rate几乎全是0.我几乎按照论文参数来配置，除了一个rollout
  **Post-Mortem & Fix Analysis**:
  > ppo依赖于大并行，rollout不能减少。
  > 你好，那为什么我的mat和mappo也是rollout=8，但是结果并不比论文里面的差多少呢。就是happo出现问题。如果我统一rollout=8进行比较的话，这是被允许的吗
  > 可以麻烦给我一个地图的，训练happo/hatrpo的脚本吗，我可能脚本里面的某些参数没有搞好

- **Issue #126** (2025-06-29): **multi-task of MAPPO**
  *Symptoms*: In file config.py, I note that it has parameters for multi-task, such as      # add for online multi-task     parser.add_argument("--train_maps", type=str, nargs='+', default=None)     parser.add_argument("--eval_maps", type=str, nargs='+', default=None)   But this code donot use this parameters and i cann't find the multi-task learning in code. Is the code for mappo in multi-task learning open source?
  **Post-Mortem & Fix Analysis**:
  > Nope, we don't open source multi-task part.

- **Issue #114** (2024-09-16): **Update on-policy to work with pettingzoo environment**
  *Symptoms*: 

- **Issue #113** (2024-07-18): **fix: r_mappo & mat buffer factor unpack**
  *Symptoms*: fix bug: buffer factor unpack error in `r_mappo` and `mat`

- **Issue #111** (2024-07-03): **Master**
  *Symptoms*: 

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

### Incident Patch 1: `cfc6f6df` (2024-07-17)
**Commit Message**: fix: r_mappo & mat buffer factor unpack

**File**: `onpolicy/algorithms/mat/mat_trainer.py` (modified, +8/-3)
```diff
@@ -103,9 +103,14 @@ def ppo_update(self, sample):
         :return actor_grad_norm: (torch.Tensor) gradient norm from actor update.
         :return imp_weights: (torch.Tensor) importance sampling weights.
         """
-        share_obs_batch, obs_batch, rnn_states_batch, rnn_states_critic_batch, actions_batch, \
-        value_preds_batch, return_batch, masks_batch, active_masks_batch, old_action_log_probs_batch, \
-        adv_targ, available_actions_batch = sample
+        if len(sample) == 12:
+            share_obs_batch, obs_batch, rnn_states_batch, rnn_states_critic_batch, actions_batch, \
+            value_preds_batch, return_batch, masks_batch, active_masks_batch, old_action_log_probs_batch, \
+            adv_targ, available_actions_batch = sample
+        else:
+            share_obs_batch, obs_batch, rnn_states_batch, rnn_states_critic_batch, actions_batch, \
+            value_preds_batch, return_batch, masks_batch, active_masks_batch, old_action_log_probs_batch, \
+            adv_targ, available_actions_batch, _ = sample
 
         old_action_log_probs_batch = check(old_action_log_probs_batch).to(**self.tpdv)
         adv_targ = check(adv_targ).to(**self.tpdv)
```

**File**: `onpolicy/algorithms/r_mappo/r_mappo.py` (modified, +8/-3)
```diff
@@ -101,9 +101,14 @@ def ppo_update(self, sample, update_actor=True):
         :return actor_grad_norm: (torch.Tensor) gradient norm from actor update.
         :return imp_weights: (torch.Tensor) importance sampling weights.
         """
-        share_obs_batch, obs_batch, rnn_states_batch, rnn_states_critic_batch, actions_batch, \
-        value_preds_batch, return_batch, masks_batch, active_masks_batch, old_action_log_probs_batch, \
-        adv_targ, available_actions_batch = sample
+        if len(sample) == 12:
+            share_obs_batch, obs_batch, rnn_states_batch, rnn_states_critic_batch, actions_batch, \
+            value_preds_batch, return_batch, masks_batch, active_masks_batch, old_action_log_probs_batch, \
+            adv_targ, available_actions_batch = sample
+        else:
+            share_obs_batch, obs_batch, rnn_states_batch, rnn_states_critic_batch, actions_batch, \
+            value_preds_batch, return_batch, masks_batch, active_masks_batch, old_action_log_probs_batch, \
+            adv_targ, available_actions_batch, _ = sample
 
         old_action_log_probs_batch = check(old_action_log_probs_batch).to(**self.tpdv)
         adv_targ = check(adv_targ).to(**self.tpdv)
```

---

### Incident Patch 2: `f674d2ed` (2024-04-17)
**Commit Message**: fixed bug in initializing ValueNorm

Was running into the following error with the previous version: "RuntimeError: Expected all tensors to be on the same device, but found at least two devices, cuda:0 and CPU!"

**File**: `onpolicy/algorithms/r_mappo/r_mappo.py` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ def __init__(self,
         if self._use_popart:
             self.value_normalizer = self.policy.critic.v_out
         elif self._use_valuenorm:
-            self.value_normalizer = ValueNorm(1).to(self.device)
+            self.value_normalizer = ValueNorm(1, device=self.device)
         else:
             self.value_normalizer = None
 
```

---

### Incident Patch 3: `6df12606` (2024-02-03)
**Commit Message**: train_smac_8m_vs_9m.sh bug fix

**File**: `onpolicy/scripts/train_smac_scripts/train_smac_8m_vs_9m.sh` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 #!/bin/sh
 env="StarCraft2"
-map="bane_vs_bane"
+map="8m_vs_9m"
 algo="rmappo"
 exp="check"
 seed_max=1
@@ -11,5 +11,5 @@ do
     echo "seed is ${seed}:"
     CUDA_VISIBLE_DEVICES=0 python ../train/train_smac.py --env_name ${env} --algorithm_name ${algo} --experiment_name ${exp} \
     --map_name ${map} --seed ${seed} --n_training_threads 1 --n_rollout_threads 8 --num_mini_batch 1 --episode_length 400 \
-    --num_env_steps 10000000 --ppo_epoch 15 --use_value_active_masks --use_eval --eval_episodes 32 --clip_param 0.05
+    --num_env_steps 10000000 --ppo_epoch 15 --clip_param 0.05 --use_value_active_masks --use_eval --eval_episodes 32
 done
```

---

### Incident Patch 4: `0affe7f4` (2023-09-21)
**Commit Message**: Merge pull request #86 from jason-huang03/fix_smacv2_environment_bugs

fix smacv2 dones bugs and a type bug

**File**: `onpolicy/envs/starcraft2/SMACv2_modified.py` (modified, +9/-1)
```diff
@@ -31,7 +31,15 @@ def step(self, actions):
         local_obs = self.get_obs()
         global_state = np.array([self.env.get_state_agent(agent_id) for agent_id in range(self.env.n_agents)])
         rewards = [[reward]] * self.env.n_agents
-        dones = [terminated] * self.env.n_agents
+
+        dones = []
+
+        for i in range(self.env.n_agents):
+            if terminated:
+                dones.append(True)
+            else:
+                dones.append(self.env.death_tracker_ally[i])
+
         infos = [info] * self.env.n_agents
         avail_actions = [self.get_avail_agent_actions(i) for i in range(self.env.n_agents)]
         
```

**File**: `onpolicy/envs/starcraft2/StarCraft2v2/starcraft2.py` (modified, +1/-1)
```diff
@@ -488,7 +488,7 @@ def _launch(self):
                         [(b >> i) & 1 for b in row for i in range(7, -1, -1)]
                         for row in vals
                     ],
-                    dtype=np.bool,
+                    dtype=bool,
                 )
             )
         else:
```

---

### Incident Patch 5: `599dedf2` (2023-09-08)
**Commit Message**: fix smacv2 dones bugs and a type bug

**File**: `onpolicy/envs/starcraft2/SMACv2_modified.py` (modified, +9/-1)
```diff
@@ -31,7 +31,15 @@ def step(self, actions):
         local_obs = self.get_obs()
         global_state = np.array([self.env.get_state_agent(agent_id) for agent_id in range(self.env.n_agents)])
         rewards = [[reward]] * self.env.n_agents
-        dones = [terminated] * self.env.n_agents
+
+        dones = []
+
+        for i in range(self.env.n_agents):
+            if terminated:
+                dones.append(True)
+            else:
+                dones.append(self.env.death_tracker_ally[i])
+
         infos = [info] * self.env.n_agents
         avail_actions = [self.get_avail_agent_actions(i) for i in range(self.env.n_agents)]
         
```

**File**: `onpolicy/envs/starcraft2/StarCraft2v2/starcraft2.py` (modified, +1/-1)
```diff
@@ -488,7 +488,7 @@ def _launch(self):
                         [(b >> i) & 1 for b in row for i in range(7, -1, -1)]
                         for row in vals
                     ],
-                    dtype=np.bool,
+                    dtype=bool,
                 )
             )
         else:
```

---

### Incident Patch 6: `9424f348` (2022-09-28)
**Commit Message**: M: shared runner. Bugfix.

**File**: `onpolicy/runner/shared/base_runner.py` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ def save(self):
         policy_critic = self.trainer.policy.critic
         torch.save(policy_critic.state_dict(), str(self.save_dir) + "/critic.pt")
         if self.trainer._use_valuenorm:
-            policy_vnorm = self.trainer.policy.value_normalizer
+            policy_vnorm = self.trainer.value_normalizer
             torch.save(policy_vnorm.state_dict(), str(self.save_dir) + "/vnorm.pt")
 
     def restore(self):
```

---

### Incident Patch 7: `b5c1e75c` (2021-04-23)
**Commit Message**: add popart & value norm, fix minor bug in smac & mpe & config.py, update training scripts.

**File**: `onpolicy/algorithms/r_mappo/algorithm/r_actor_critic.py` (modified, +6/-1)
```diff
@@ -5,6 +5,7 @@
 from onpolicy.algorithms.utils.mlp import MLPBase
 from onpolicy.algorithms.utils.rnn import RNNLayer
 from onpolicy.algorithms.utils.act import ACTLayer
+from onpolicy.algorithms.utils.popart import PopArt
 from onpolicy.utils.util import get_shape_from_obs_space
 
 
@@ -121,6 +122,7 @@ def __init__(self, args, cent_obs_space, device=torch.device("cpu")):
         self._use_naive_recurrent_policy = args.use_naive_recurrent_policy
         self._use_recurrent_policy = args.use_recurrent_policy
         self._recurrent_N = args.recurrent_N
+        self._use_popart = args.use_popart
         self.tpdv = dict(dtype=torch.float32, device=device)
         init_method = [nn.init.xavier_uniform_, nn.init.orthogonal_][self._use_orthogonal]
 
@@ -134,7 +136,10 @@ def __init__(self, args, cent_obs_space, device=torch.device("cpu")):
         def init_(m):
             return init(m, init_method, lambda x: nn.init.constant_(x, 0))
 
-        self.v_out = init_(nn.Linear(self.hidden_size, 1))
+        if self._use_popart:
+            self.v_out = init_(PopArt(self.hidden_size, 1, device=device))
+        else:
+            self.v_out = init_(nn.Linear(self.hidden_size, 1))
 
         self.to(device)
 
```

**File**: `onpolicy/algorithms/r_mappo/r_mappo.py` (modified, +12/-8)
```diff
@@ -2,7 +2,7 @@
 import torch
 import torch.nn as nn
 from onpolicy.utils.util import get_gard_norm, huber_loss, mse_loss
-from onpolicy.utils.popart import PopArt
+from onpolicy.utils.valuenorm import ValueNorm
 from onpolicy.algorithms.utils.util import check
 
 class R_MAPPO():
@@ -36,11 +36,16 @@ def __init__(self,
         self._use_clipped_value_loss = args.use_clipped_value_loss
         self._use_huber_loss = args.use_huber_loss
         self._use_popart = args.use_popart
+        self._use_valuenorm = args.use_valuenorm
         self._use_value_active_masks = args.use_value_active_masks
         self._use_policy_active_masks = args.use_policy_active_masks
         
+        assert (self._use_popart and self._use_valuenorm) == False, ("self._use_popart and self._use_valuenorm can not be set True simultaneously")
+        
         if self._use_popart:
-            self.value_normalizer = PopArt(1, device=self.device)
+            self.value_normalizer = self.policy.critic.v_out
+        elif self._use_valuenorm:
+            self.value_normalizer = ValueNorm(1, device = self.device)
         else:
             self.value_normalizer = None
 
@@ -54,14 +59,13 @@ def cal_value_loss(self, values, value_preds_batch, return_batch, active_masks_b
 
         :return value_loss: (torch.Tensor) value function loss.
         """
-        if self._use_popart:
-            value_pred_clipped = value_preds_batch + (values - value_preds_batch).clamp(-self.clip_param,
+        value_pred_clipped = value_preds_batch + (values - value_preds_batch).clamp(-self.clip_param,
                                                                                         self.clip_param)
-            error_clipped = self.value_normalizer(return_batch) - value_pred_clipped
-            error_original = self.value_normalizer(return_batch) - values
+        if self._use_popart or self._use_valuenorm:
+            self.value_normalizer.update(return_batch)
+            error_clipped = self.value_normalizer.normalize(return_batch) - value_pred_clipped
+            error_original = self.value_normalizer.normalize(return_batch) - values
         else:
-            value_pred_clipped = value_preds_batch + (values - value_preds_batch).clamp(-self.clip_param,
-                                                                                        self.clip_param)
             error_clipped = return_batch - value_pred_clipped
             error_original = return_batch - values
 
```

**File**: `onpolicy/algorithms/utils/popart.py` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+import math
+import numpy as np
+import torch
+import torch.nn as nn
+import torch.nn.functional as F
+
+class PopArt(torch.nn.Module):
+    
+    def __init__(self, input_shape, output_shape, norm_axes=1, beta=0.99999, epsilon=1e-5, device=torch.device("cpu")):
+        
+        super(PopArt, self).__init__()
+
+        self.beta = beta
+        self.epsilon = epsilon
+        self.norm_axes = norm_axes
+        self.tpdv = dict(dtype=torch.float32, device=device)
+
+        self.input_shape = input_shape
+        self.output_shape = output_shape
+
+        self.weight = nn.Parameter(torch.Tensor(output_shape, input_shape)).to(**self.tpdv)
+        self.bias = nn.Parameter(torch.Tensor(output_shape)).to(**self.tpdv)
+        
+        self.stddev = nn.Parameter(torch.ones(output_shape), requires_grad=False).to(**self.tpdv)
+        self.mean = nn.Parameter(torch.zeros(output_shape), requires_grad=False).to(**self.tpdv)
+        self.mean_sq = nn.Parameter(torch.zeros(output_shape), requires_grad=False).to(**self.tpdv)
+        self.debiasing_term = nn.Parameter(torch.tensor(0.0), requires_grad=False).to(**self.tpdv)
+
+        self.reset_parameters()
+
+    def reset_parameters(self):
+        torch.nn.init.kaiming_uniform_(self.weight, a=math.sqrt(5))
+        if self.bias is not None:
+            fan_in, _ = torch.nn.init._calculate_fan_in_and_fan_out(self.weight)
+            bound = 1 / math.sqrt(fan_in)
+            torch.nn.init.uniform_(self.bias, -bound, bound)
+        self.mean.zero_()
+        self.mean_sq.zero_()
+        self.debiasing_term.zero_()
+
+    def forward(self, input_vector):
+        if type(input_vector) == np.ndarray:
+            input_vector = torch.from_numpy(input_vector)
+        input_vector = input_vector.to(**self.tpdv)
+
+        return F.linear(input_vector, self.weight, self.bias)
+    
+    @torch.no_grad()
+    def update(self, input_vector):
+        if type(input_vector) == np.ndarray:
+            input_vector = torch.from_numpy(input_vector)
+        input_vector = input_vector.to(**self.tpdv)
+        
+        old_mean, old_stddev = self.mean, self.stddev
+
+        batch_mean = input_vector.mean(dim=tuple(range(self.norm_axes)))
+        batch_sq_mean = (input_vector ** 2).mean(dim=tuple(range(self.norm_axes)))
+
+        self.mean.mul_(self.beta).add_(batch_mean * (1.0 - self.beta))
+        self.mean_sq.mul_(self.beta).add_(batch_sq_mean * (1.0 - self.beta))
+        self.debiasing_term.mul_(self.beta).add_(1.0 * (1.0 - self.beta))
+
+        self.stddev = (self.mean_sq - self.mean ** 2).sqrt().clamp(min=1e-4)
+
+        self.weight = self.weight * old_stddev / self.stddev
+        self.bias = (old_stddev * self.bias + old_mean - self.mean) / self.stddev
+
+    def debiased_mean_var(self):
+        debiased_mean = self.mean / self.debiasing_term.clamp(min=self.epsilon)
+        debiased_mean_sq = self.mean_sq / self.debiasing_term.clamp(min=self.epsilon)
+        debiased_var = (debiased_mean_sq - debiased_mean ** 2).clamp(min=1e-2)
+        return debiased_mean, debiased_var
+
+    def normalize(self, input_vector):
+        if type(input_vector) == np.ndarray:
+            input_vector = torch.from_numpy(input_vector)
+        input_vector = input_vector.to(**self.tpdv)
+
+        mean, var = self.debiased_mean_var()
+        out = (input_vector - mean[(None,) * self.norm_axes]) / torch.sqrt(var)[(None,) * self.norm_axes]
+        
+        return out
+
+    def denormalize(self, input_vector):
+        if type(input_vector) == np.ndarray:
+            input_vector = torch.from_numpy(input_vector)
+        input_vector = input_vector.to(**self.tpdv)
+
+        mean, var = self.debiased_mean_var()
+        out = input_vector * torch.sqrt(var)[(None,) * self.norm_axes] + mean[(None,) * self.norm_axes]
+        
+        out = out.cpu().numpy()
+
+        return out
```

**File**: `onpolicy/config.py` (modified, +6/-3)
```diff
@@ -57,6 +57,8 @@ def get_config():
         --use_ReLU
             by default True, will use ReLU. or else will use Tanh.
         --use_popart
+            by default True, use PopArt to normalize rewards. 
+        --use_valuenorm
             by default True, use running mean and std to normalize rewards. 
         --use_feature_normalization
             by default True, apply layernorm to normalize inputs. 
@@ -200,7 +202,8 @@ def get_config():
                         help="Number of layers for actor/critic networks")
     parser.add_argument("--use_ReLU", action='store_false',
                         default=True, help="Whether to use ReLU")
-    parser.add_argument("--use_popart", action='store_false', default=True, help="by default True, use running mean and std to normalize rewards.")
+    parser.add_argument("--use_popart", action='store_true', default=False, help="by default False, use PopArt to normalize rewards.")
+    parser.add_argument("--use_valuenorm", action='store_false', default=True, help="by default True, use running mean and std to normalize rewards.")
     parser.add_argument("--use_feature_normalization", action='store_false',
                         default=True, help="Whether to apply layernorm to the inputs")
     parser.add_argument("--use_orthogonal", action='store_false', default=True,
@@ -211,8 +214,8 @@ def get_config():
     # recurrent parameters
     parser.add_argument("--use_naive_recurrent_policy", action='store_true',
                         default=False, help='Whether to use a naive recurrent policy')
-    parser.add_argument("--use_recurrent_policy", action='store_true',
-                        default=False, help='use a recurrent policy')
+    parser.add_argument("--use_recurrent_policy", action='store_false',
+                        default=True, help='use a recurrent policy')
     parser.add_argument("--recurrent_N", type=int, default=1, help="The number of recurrent layers.")
     parser.add_argument("--data_chunk_length", type=int, default=10,
                         help="Time length of chunks used to train a recurrent_policy")
```

**File**: `onpolicy/envs/starcraft2/StarCraft2_Env.py` (modified, +2/-2)
```diff
@@ -1567,7 +1567,7 @@ def get_state_ally_feats_size(self):
         if self.obs_all_health:
             nf_al += 1 + self.shield_bits_ally
 
-        if self.obs_last_action:
+        if self.state_last_action:
             nf_al += self.n_actions
         
         if self.add_center_xy:
@@ -1594,7 +1594,7 @@ def get_state_own_feats_size(self):
         if self.obs_own_health:
             own_feats += 1 + self.shield_bits_ally
 
-        if self.obs_last_action:
+        if self.state_last_action:
             own_feats += self.n_actions
 
         if self.add_center_xy:
```

---

### Incident Patch 8: `4f97d7ff` (2021-04-21)
**Commit Message**: fix mpe render bug

**File**: `onpolicy/runner/shared/mpe_runner.py` (modified, +2/-2)
```diff
@@ -188,7 +188,7 @@ def render(self):
         for episode in range(self.all_args.render_episodes):
             obs = envs.reset()
             if self.all_args.save_gifs:
-                image = envs.render('rgb_array', close=False)[0]
+                image = envs.render('rgb_array')[0][0]
                 all_frames.append(image)
 
             rnn_states = np.zeros((self.n_rollout_threads, self.num_agents, self.recurrent_N, self.hidden_size), dtype=np.float32)
@@ -228,7 +228,7 @@ def render(self):
                 masks[dones == True] = np.zeros(((dones == True).sum(), 1), dtype=np.float32)
 
                 if self.all_args.save_gifs:
-                    image = envs.render('rgb_array', close=False)[0]
+                    image = envs.render('rgb_array')[0][0]
                     all_frames.append(image)
                     calc_end = time.time()
                     elapsed = calc_end - calc_start
```

---

### Incident Patch 9: `59ad96b3` (2021-03-09)
**Commit Message**: fix shape

**File**: `onpolicy/algorithms/r_mappo/algorithm/r_actor_critic.py` (modified, +3/-3)
```diff
@@ -124,9 +124,9 @@ def __init__(self, args, cent_obs_space, device=torch.device("cpu")):
         self.tpdv = dict(dtype=torch.float32, device=device)
         init_method = [nn.init.xavier_uniform_, nn.init.orthogonal_][self._use_orthogonal]
 
-        cent_obs_space = get_shape_from_obs_space(cent_obs_space)
-        base = CNNBase if len(cent_obs_space) == 3 else MLPBase
-        self.base = base(args, cent_obs_space)
+        cent_obs_shape = get_shape_from_obs_space(cent_obs_space)
+        base = CNNBase if len(cent_obs_shape) == 3 else MLPBase
+        self.base = base(args, cent_obs_shape)
 
         if self._use_naive_recurrent_policy or self._use_recurrent_policy:
             self.rnn = RNNLayer(self.hidden_size, self.hidden_size, self._recurrent_N, self._use_orthogonal)
```

#### Recent Merged Pull Requests:
- **PR #132** (closed): Fix numpy array stacking for heterogeneous observation shapes (@nkxv)
- **PR #128** (closed): Visualizations (@LucaMertens)
- **PR #114** (closed): Update on-policy to work with pettingzoo environment (@conor-wallace)
- **PR #113** (2024-07-18): fix: r_mappo & mat buffer factor unpack (@HosnLS)
- **PR #111** (closed): Master (@Malhaar-k)
- **PR #107** (2024-06-08): fixed bug in initializing ValueNorm (@Nikunj-Gupta)
- **PR #100** (2024-02-17): 'on-policy\onpolicy\scripts\train_smac_scripts\train_smac_8m_vs_9m.sh' training script file bug fix (@JensenLZX)
- **PR #95** (closed): Update Overcooked (@Aidilele)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
