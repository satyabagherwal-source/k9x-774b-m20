# Forensic Learning Record (Deep Inspection): marlbenchmark/on-policy

> **Canonical Artifact**: `07_PROJECT_LEARNING/marlbenchmark-on-policy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/marlbenchmark/on-policy](https://github.com/marlbenchmark/on-policy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:11:22.481Z  
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

### Core Architecture Module: `onpolicy/algorithms/utils/act.py`
```
from .distributions import Bernoulli, Categorical, DiagGaussian
import torch
import torch.nn as nn

class ACTLayer(nn.Module):
    """
    MLP Module to compute actions.
    :param action_space: (gym.Space) action space.
    :param inputs_dim: (int) dimension of network input.
    :param use_orthogonal: (bool) whether to use orthogonal initialization.
    :param gain: (float) gain of the output layer of the network.
    """
    def __init__(self, action_space, inputs_dim, use_orthogonal, gain, args=None):
        super(ACTLayer, self).__init__()
        self.mixed_action = False
        self.multi_discrete = False
        self.mujoco_box = False
        self.action_type = action_space.__class__.__name__

        if action_space.__class__.__name__ == "Discrete":
            action_dim = action_space.n
            self.action_out = Categorical(inputs_dim, action_dim, use_orthogonal, gain)
        elif action_space.__class__.__name__ == "Box":
            self.mujoco_box = True
            action_dim = action_space.shape[0]
            self.action_out = DiagGaussian(inputs_dim, action_dim, use_orthogonal, gain)
        elif action_space.__class__.__name__ == "MultiBinary":
            action_dim = action_space.shape[0]
            self.action_out = Bernoulli(inputs_dim, action_dim, use_orthogonal, gain)
        elif action_space.__class__.__name__ == "MultiDiscrete":
            self.multi_discrete = True
            action_dims = action_space.high - action_space.low + 1
            self.action_outs = []
            for action_dim in action_dims:
                self.action_outs.append(Categorical(inputs_dim, action_dim, use_orthogonal, gain))
            self.action_outs = nn.ModuleList(self.action_outs)
        else:  # discrete + continous
            self.mixed_action = True
            continous_dim = action_space[0].shape[0]
            discrete_dim = action_space[1].n
            self.action_outs = nn.ModuleList([DiagGaussian(inputs_dim, continous_dim, use_orthogonal, gain), Categorical(
                inputs_dim, discrete_dim, use_orthogonal, gain)])
    
    def forward(self, x, available_actions=None, deterministic=False):
        """
        Compute actions and action logprobs from given input.
        :param x: (torch.Tensor) input to network.
        :param available_actions: (torch.Tensor) denotes which actions are available to agent
                                  (if None, all actions available)
        :param deterministic: (bool) whether to sample from action distribution or return the mode.

        :return actions: (torch.Tensor) actions to take.
        :return action_log_probs: (torch.Tensor) log probabilities of taken actions.
        """
        if self.mixed_action :
            actions = []
            action_log_probs = []
            for action_out in self.action_outs:
                action_logit = action_out(x)
                action = action_logit.mode() if deterministic else action_logit.sample()
                action_log_prob = action_logit.log_probs(action)
                actions.append(action.float())
                action_log_probs.append(action_log_prob)

            actions = torch.cat(actions, -1)
            action_log_probs = torch.sum(torch.cat(action_log_probs, -1), -1, keepdim=True)

        elif self.multi_discrete:
            actions = []
            action_log_probs = []
            for action_out in self.action_outs:
                action_logit = action_out(x)
                action = action_logit.mode() if deterministic else action_logit.sample()
                action_log_prob = action_logit.log_probs(action)
                actions.append(action)
                action_log_probs.append(action_log_prob)

            actions = torch.cat(actions, -1)
            action_log_probs = torch.cat(action_log_probs, -1)

        elif self.mujoco_box:
            action_logits = self.action_out(x)
            actions = action_logits.mode() if deterministic else action_logits.sample() 
            action_log_probs = action_logits.log_probs(actions)
        
        else:
            action_logits = self.action_out(x, available_actions)
            actions = action_logits.mode() if deterministic else action_logits.sample() 
            action_log_probs = action_logits.log_probs(actions)
        
        return actions, action_log_probs

    def get_probs(self, x, available_actions=None):
        """
        Compute action probabilities from inputs.
        :param x: (torch.Tensor) input to network.
        :param available_actions: (torch.Tensor) denotes which actions are available to agent
                                  (if None, all actions available)

        :return action_probs: (torch.Tensor)
        """
        if self.mixed_action or self.multi_discrete:
            action_probs = []
            for action_out in self.action_outs:
                action_logit = action_out(x)
                action_prob = action_logit.probs
                action_probs.append(action_prob)
            action_probs = torch.cat(action_probs, -1)
        else:
            action_logits = self.action_out(x, available_actions)
            action_probs = action_logits.probs
        
        return action_probs

    def evaluate_actions(self, x, action, available_actions=None, active_masks=None):
        """
        Compute log probability and entropy of given actions.
        :param x: (torch.Tensor) input to network.
        :param action: (torch.Tensor) actions whose entropy and log probability to evaluate.
        :param available_actions: (torch.Tensor) denotes which actions are available to agent
                                                              (if None, all actions available)
        :param active_masks: (torch.Tensor) denotes whether an agent is active or dead.

        :return action_log_probs: (torch.Tensor) log probabilities of the input actions.
        :return dist_entropy: (torch.Tensor) action distribution entropy for the given inputs.
        """
        if self.mixed_action:
            a, b = action.split((2, 1), -1)
            b = b.long()
            action = [a, b] 
            action_log_probs = [] 
            dist_entropy = []
            for action_out, act in zip(self.action_outs, action):
                action_logit = action_out(x)
                action_log_probs.append(action_logit.log_probs(act))
                if active_masks is not None:
                    if len(action_logit.entropy().shape) == len(active_masks.shape):
                        dist_entropy.append((action_logit.entropy() * active_masks).sum()/active_masks.sum()) 
                    else:
                        dist_entropy.append((action_logit.entropy() * active_masks.squeeze(-1)).sum()/active_masks.sum())
                else:
                    dist_entropy.append(action_logit.entropy().mean())
                
            action_log_probs = torch.sum(torch.cat(action_log_probs, -1), -1, keepdim=True)
            dist_entropy = dist_entropy[0] / 2.0 + dist_entropy[1] / 0.98 #! dosen't make sense

        elif self.multi_discrete:
            action = torch.transpose(action, 0, 1)
            action_log_probs = []
            dist_entropy = []
            for action_out, act in zip(self.action_outs, action):
                action_logit = action_out(x)
                action_log_probs.append(action_logit.log_probs(act))
                if active_masks is not None:
                    dist_entropy.append((action_logit.entropy()*active_masks.squeeze(-1)).sum()/active_masks.sum())
                else:
                    dist_entropy.append(action_logit.entropy().mean())

            action_log_probs = torch.cat(action_log_probs, -1) # ! could be wrong
            dist_entropy = sum(dist_entropy)/len(dist_entropy)
        
        elif self.mujoco_box:
            action_logits = self.action_out(x)
            action_log_probs = action_logits.log_probs(action)
            if active_masks is not None:
                dist_entropy = (action_logits.entropy()*active_masks.squeeze(-1)).sum()/active_masks.sum()
            else:
                dist_entropy = action_logits.entropy().mean()

        else:
            action_logits = self.action_out(x, available_actions)
            action_log_probs = action_logits.log_probs(action)
            if active_masks is not None:
                dist_entropy = (action_logits.entropy()*active_masks.squeeze(-1)).sum()/active_masks.sum()
            else:
                dist_entropy = action_logits.entropy().mean()
        
        return action_log_probs, dist_entropy

    def evaluate_actions_trpo(self, x, action, available_actions=None, active_masks=None):
        """
        Compute log probability and entropy of given actions.
        :param x: (torch.Tensor) input to network.
        :param action: (torch.Tensor) actions whose entropy and log probability to evaluate.
        :param available_actions: (torch.Tensor) denotes which actions are available to agent
                                                              (if None, all actions available)
        :param active_masks: (torch.Tensor) denotes whether an agent is active or dead.

        :return action_log_probs: (torch.Tensor) log probabilities of the input actions.
        :return dist_entropy: (torch.Tensor) action distribution entropy for the given inputs.
        """

        if self.multi_discrete:
            action = torch.transpose(action, 0, 1)
            action_log_probs = []
            dist_entropy = []
            mu_collector = []
            std_collector = []
            probs_collector = []
            for action_out, act in zip(self.action_outs, action):
                action_logit = action_out(x)
                mu = action_logit.mean
                std = action_logit.stddev
                action_log_probs.append(action_logit.log_probs(act))
                mu_collector.append(mu)
                std_collector.append(std)
                probs_
```

### Core Architecture Module: `onpolicy/algorithms/utils/cnn.py`
```
import torch.nn as nn
from .util import init

"""CNN Modules and utils."""

class Flatten(nn.Module):
    def forward(self, x):
        return x.view(x.size(0), -1)


class CNNLayer(nn.Module):
    def __init__(self, obs_shape, hidden_size, use_orthogonal, use_ReLU, kernel_size=3, stride=1):
        super(CNNLayer, self).__init__()

        active_func = [nn.Tanh(), nn.ReLU()][use_ReLU]
        init_method = [nn.init.xavier_uniform_, nn.init.orthogonal_][use_orthogonal]
        gain = nn.init.calculate_gain(['tanh', 'relu'][use_ReLU])

        def init_(m):
            return init(m, init_method, lambda x: nn.init.constant_(x, 0), gain=gain)

        input_channel = obs_shape[0]
        input_width = obs_shape[1]
        input_height = obs_shape[2]

        self.cnn = nn.Sequential(
            init_(nn.Conv2d(in_channels=input_channel,
                            out_channels=hidden_size // 2,
                            kernel_size=kernel_size,
                            stride=stride)
                  ),
            active_func,
            Flatten(),
            init_(nn.Linear(hidden_size // 2 * (input_width - kernel_size + stride) * (input_height - kernel_size + stride),
                            hidden_size)
                  ),
            active_func,
            init_(nn.Linear(hidden_size, hidden_size)), active_func)

    def forward(self, x):
        x = x / 255.0
        x = self.cnn(x)
        return x


class CNNBase(nn.Module):
    def __init__(self, args, obs_shape):
        super(CNNBase, self).__init__()

        self._use_orthogonal = args.use_orthogonal
        self._use_ReLU = args.use_ReLU
        self.hidden_size = args.hidden_size

        self.cnn = CNNLayer(obs_shape, self.hidden_size, self._use_orthogonal, self._use_ReLU)

    def forward(self, x):
        x = self.cnn(x)
        return x

```

### Core Architecture Module: `onpolicy/algorithms/utils/mlp.py`
```
import torch.nn as nn
from .util import init, get_clones

"""MLP modules."""

class MLPLayer(nn.Module):
    def __init__(self, input_dim, hidden_size, layer_N, use_orthogonal, use_ReLU):
        super(MLPLayer, self).__init__()
        self._layer_N = layer_N

        active_func = [nn.Tanh(), nn.ReLU()][use_ReLU]
        init_method = [nn.init.xavier_uniform_, nn.init.orthogonal_][use_orthogonal]
        gain = nn.init.calculate_gain(['tanh', 'relu'][use_ReLU])

        def init_(m):
            return init(m, init_method, lambda x: nn.init.constant_(x, 0), gain=gain)

        self.fc1 = nn.Sequential(
            init_(nn.Linear(input_dim, hidden_size)), active_func, nn.LayerNorm(hidden_size))
        # self.fc_h = nn.Sequential(init_(
        #     nn.Linear(hidden_size, hidden_size)), active_func, nn.LayerNorm(hidden_size))
        # self.fc2 = get_clones(self.fc_h, self._layer_N)
        self.fc2 = nn.ModuleList([nn.Sequential(init_(
            nn.Linear(hidden_size, hidden_size)), active_func, nn.LayerNorm(hidden_size)) for i in range(self._layer_N)])

    def forward(self, x):
        x = self.fc1(x)
        for i in range(self._layer_N):
            x = self.fc2[i](x)
        return x


class MLPBase(nn.Module):
    def __init__(self, args, obs_shape, cat_self=True, attn_internal=False):
        super(MLPBase, self).__init__()

        self._use_feature_normalization = args.use_feature_normalization
        self._use_orthogonal = args.use_orthogonal
        self._use_ReLU = args.use_ReLU
        self._stacked_frames = args.stacked_frames
        self._layer_N = args.layer_N
        self.hidden_size = args.hidden_size

        obs_dim = obs_shape[0]

        if self._use_feature_normalization:
            self.feature_norm = nn.LayerNorm(obs_dim)

        self.mlp = MLPLayer(obs_dim, self.hidden_size,
                              self._layer_N, self._use_orthogonal, self._use_ReLU)

    def forward(self, x):
        if self._use_feature_normalization:
            x = self.feature_norm(x)

        x = self.mlp(x)

        return x
```

### Core Architecture Module: `onpolicy/algorithms/utils/popart.py`
```
import math
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

class PopArt(torch.nn.Module):
    
    def __init__(self, input_shape, output_shape, norm_axes=1, beta=0.99999, epsilon=1e-5, device=torch.device("cpu")):
        
        super(PopArt, self).__init__()

        self.beta = beta
        self.epsilon = epsilon
        self.norm_axes = norm_axes
        self.tpdv = dict(dtype=torch.float32, device=device)

        self.input_shape = input_shape
        self.output_shape = output_shape

        self.weight = nn.Parameter(torch.Tensor(output_shape, input_shape)).to(**self.tpdv)
        self.bias = nn.Parameter(torch.Tensor(output_shape)).to(**self.tpdv)
        
        self.stddev = nn.Parameter(torch.ones(output_shape), requires_grad=False).to(**self.tpdv)
        self.mean = nn.Parameter(torch.zeros(output_shape), requires_grad=False).to(**self.tpdv)
        self.mean_sq = nn.Parameter(torch.zeros(output_shape), requires_grad=False).to(**self.tpdv)
        self.debiasing_term = nn.Parameter(torch.tensor(0.0), requires_grad=False).to(**self.tpdv)

        self.reset_parameters()

    def reset_parameters(self):
        torch.nn.init.kaiming_uniform_(self.weight, a=math.sqrt(5))
        if self.bias is not None:
            fan_in, _ = torch.nn.init._calculate_fan_in_and_fan_out(self.weight)
            bound = 1 / math.sqrt(fan_in)
            torch.nn.init.uniform_(self.bias, -bound, bound)
        self.mean.zero_()
        self.mean_sq.zero_()
        self.debiasing_term.zero_()

    def forward(self, input_vector):
        if type(input_vector) == np.ndarray:
            input_vector = torch.from_numpy(input_vector)
        input_vector = input_vector.to(**self.tpdv)

        return F.linear(input_vector, self.weight, self.bias)
    
    @torch.no_grad()
    def update(self, input_vector):
        if type(input_vector) == np.ndarray:
            input_vector = torch.from_numpy(input_vector)
        input_vector = input_vector.to(**self.tpdv)
        
        old_mean, old_var = self.debiased_mean_var()
        old_stddev = torch.sqrt(old_var)

        batch_mean = input_vector.mean(dim=tuple(range(self.norm_axes)))
        batch_sq_mean = (input_vector ** 2).mean(dim=tuple(range(self.norm_axes)))

        self.mean.mul_(self.beta).add_(batch_mean * (1.0 - self.beta))
        self.mean_sq.mul_(self.beta).add_(batch_sq_mean * (1.0 - self.beta))
        self.debiasing_term.mul_(self.beta).add_(1.0 * (1.0 - self.beta))

        self.stddev = (self.mean_sq - self.mean ** 2).sqrt().clamp(min=1e-4)
        
        new_mean, new_var = self.debiased_mean_var()
        new_stddev = torch.sqrt(new_var)
        
        self.weight = self.weight * old_stddev / new_stddev
        self.bias = (old_stddev * self.bias + old_mean - new_mean) / new_stddev

    def debiased_mean_var(self):
        debiased_mean = self.mean / self.debiasing_term.clamp(min=self.epsilon)
        debiased_mean_sq = self.mean_sq / self.debiasing_term.clamp(min=self.epsilon)
        debiased_var = (debiased_mean_sq - debiased_mean ** 2).clamp(min=1e-2)
        return debiased_mean, debiased_var

    def normalize(self, input_vector):
        if type(input_vector) == np.ndarray:
            input_vector = torch.from_numpy(input_vector)
        input_vector = input_vector.to(**self.tpdv)

        mean, var = self.debiased_mean_var()
        out = (input_vector - mean[(None,) * self.norm_axes]) / torch.sqrt(var)[(None,) * self.norm_axes]
        
        return out

    def denormalize(self, input_vector):
        if type(input_vector) == np.ndarray:
            input_vector = torch.from_numpy(input_vector)
        input_vector = input_vector.to(**self.tpdv)

        mean, var = self.debiased_mean_var()
        out = input_vector * torch.sqrt(var)[(None,) * self.norm_axes] + mean[(None,) * self.norm_axes]
        
        out = out.cpu().numpy()

        return out

```

### Core Architecture Module: `onpolicy/algorithms/utils/popart_hatrpo.py`
```

import numpy as np

import torch
import torch.nn as nn


class PopArt(nn.Module):
    """ Normalize a vector of observations - across the first norm_axes dimensions"""

    def __init__(self, input_shape, norm_axes=1, beta=0.99999, per_element_update=False, epsilon=1e-5, device=torch.device("cpu")):
        super(PopArt, self).__init__()

        self.input_shape = input_shape
        self.norm_axes = norm_axes
        self.epsilon = epsilon
        self.beta = beta
        self.per_element_update = per_element_update
        self.tpdv = dict(dtype=torch.float32, device=device)

        self.running_mean = nn.Parameter(torch.zeros(input_shape), requires_grad=False).to(**self.tpdv)
        self.running_mean_sq = nn.Parameter(torch.zeros(input_shape), requires_grad=False).to(**self.tpdv)
        self.debiasing_term = nn.Parameter(torch.tensor(0.0), requires_grad=False).to(**self.tpdv)

    def reset_parameters(self):
        self.running_mean.zero_()
        self.running_mean_sq.zero_()
        self.debiasing_term.zero_()

    def running_mean_var(self):
        debiased_mean = self.running_mean / self.debiasing_term.clamp(min=self.epsilon)
        debiased_mean_sq = self.running_mean_sq / self.debiasing_term.clamp(min=self.epsilon)
        debiased_var = (debiased_mean_sq - debiased_mean ** 2).clamp(min=1e-2)
        return debiased_mean, debiased_var

    def forward(self, input_vector, train=True):
        # Make sure input is float32
        if type(input_vector) == np.ndarray:
            input_vector = torch.from_numpy(input_vector)
        input_vector = input_vector.to(**self.tpdv)

        if train:
            # Detach input before adding it to running means to avoid backpropping through it on
            # subsequent batches.
            detached_input = input_vector.detach()
            batch_mean = detached_input.mean(dim=tuple(range(self.norm_axes)))
            batch_sq_mean = (detached_input ** 2).mean(dim=tuple(range(self.norm_axes)))

            if self.per_element_update:
                batch_size = np.prod(detached_input.size()[:self.norm_axes])
                weight = self.beta ** batch_size
            else:
                weight = self.beta

            self.running_mean.mul_(weight).add_(batch_mean * (1.0 - weight))
            self.running_mean_sq.mul_(weight).add_(batch_sq_mean * (1.0 - weight))
            self.debiasing_term.mul_(weight).add_(1.0 * (1.0 - weight))

        mean, var = self.running_mean_var()
        out = (input_vector - mean[(None,) * self.norm_axes]) / torch.sqrt(var)[(None,) * self.norm_axes]
        
        return out

    def normalize(self, input_vector, train=True):
        return self.forward(input_vector, train)

    def denormalize(self, input_vector):
        """ Transform normalized data back into original distribution """
        if type(input_vector) == np.ndarray:
            input_vector = torch.from_numpy(input_vector)
        input_vector = input_vector.to(**self.tpdv)

        mean, var = self.running_mean_var()
        out = input_vector * torch.sqrt(var)[(None,) * self.norm_axes] + mean[(None,) * self.norm_axes]
        
        out = out.cpu().numpy()
        
        return out

```

### Core Architecture Module: `onpolicy/algorithms/utils/rnn.py`
```
import torch
import torch.nn as nn

"""RNN modules."""


class RNNLayer(nn.Module):
    def __init__(self, inputs_dim, outputs_dim, recurrent_N, use_orthogonal):
        super(RNNLayer, self).__init__()
        self._recurrent_N = recurrent_N
        self._use_orthogonal = use_orthogonal

        self.rnn = nn.GRU(inputs_dim, outputs_dim, num_layers=self._recurrent_N)
        for name, param in self.rnn.named_parameters():
            if 'bias' in name:
                nn.init.constant_(param, 0)
            elif 'weight' in name:
                if self._use_orthogonal:
                    nn.init.orthogonal_(param)
                else:
                    nn.init.xavier_uniform_(param)
        self.norm = nn.LayerNorm(outputs_dim)

    def forward(self, x, hxs, masks):
        if x.size(0) == hxs.size(0):
            x, hxs = self.rnn(x.unsqueeze(0),
                              (hxs * masks.repeat(1, self._recurrent_N).unsqueeze(-1)).transpose(0, 1).contiguous())
            x = x.squeeze(0)
            hxs = hxs.transpose(0, 1)
        else:
            # x is a (T, N, -1) tensor that has been flatten to (T * N, -1)
            N = hxs.size(0)
            T = int(x.size(0) / N)

            # unflatten
            x = x.view(T, N, x.size(1))

            # Same deal with masks
            masks = masks.view(T, N)

            # Let's figure out which steps in the sequence have a zero for any agent
            # We will always assume t=0 has a zero in it as that makes the logic cleaner
            has_zeros = ((masks[1:] == 0.0)
                         .any(dim=-1)
                         .nonzero()
                         .squeeze()
                         .cpu())

            # +1 to correct the masks[1:]
            if has_zeros.dim() == 0:
                # Deal with scalar
                has_zeros = [has_zeros.item() + 1]
            else:
                has_zeros = (has_zeros + 1).numpy().tolist()

            # add t=0 and t=T to the list
            has_zeros = [0] + has_zeros + [T]

            hxs = hxs.transpose(0, 1)

            outputs = []
            for i in range(len(has_zeros) - 1):
                # We can now process steps that don't have any zeros in masks together!
                # This is much faster
                start_idx = has_zeros[i]
                end_idx = has_zeros[i + 1]
                temp = (hxs * masks[start_idx].view(1, -1, 1).repeat(self._recurrent_N, 1, 1)).contiguous()
                rnn_scores, hxs = self.rnn(x[start_idx:end_idx], temp)
                outputs.append(rnn_scores)

            # assert len(outputs) == T
            # x is a (T, N, -1) tensor
            x = torch.cat(outputs, dim=0)

            # flatten
            x = x.reshape(T * N, -1)
            hxs = hxs.transpose(0, 1)

        x = self.norm(x)
        return x, hxs

```

### Core Architecture Module: `onpolicy/algorithms/utils/transformer_act.py`
```
import torch
from torch.distributions import Categorical, Normal
from torch.nn import functional as F


def discrete_autoregreesive_act(decoder, obs_rep, obs, batch_size, n_agent, action_dim, tpdv,
                                available_actions=None, deterministic=False):
    shifted_action = torch.zeros((batch_size, n_agent, action_dim + 1)).to(**tpdv)
    shifted_action[:, 0, 0] = 1
    output_action = torch.zeros((batch_size, n_agent, 1), dtype=torch.long)
    output_action_log = torch.zeros_like(output_action, dtype=torch.float32)

    for i in range(n_agent):
        logit = decoder(shifted_action, obs_rep, obs)[:, i, :]
        if available_actions is not None:
            logit[available_actions[:, i, :] == 0] = -1e10

        distri = Categorical(logits=logit)
        action = distri.probs.argmax(dim=-1) if deterministic else distri.sample()
        action_log = distri.log_prob(action)

        output_action[:, i, :] = action.unsqueeze(-1)
        output_action_log[:, i, :] = action_log.unsqueeze(-1)
        if i + 1 < n_agent:
            shifted_action[:, i + 1, 1:] = F.one_hot(action, num_classes=action_dim)
    return output_action, output_action_log


def discrete_parallel_act(decoder, obs_rep, obs, action, batch_size, n_agent, action_dim, tpdv,
                          available_actions=None):
    one_hot_action = F.one_hot(action.squeeze(-1), num_classes=action_dim)  # (batch, n_agent, action_dim)
    shifted_action = torch.zeros((batch_size, n_agent, action_dim + 1)).to(**tpdv)
    shifted_action[:, 0, 0] = 1
    shifted_action[:, 1:, 1:] = one_hot_action[:, :-1, :]
    logit = decoder(shifted_action, obs_rep, obs)
    if available_actions is not None:
        logit[available_actions == 0] = -1e10

    distri = Categorical(logits=logit)
    action_log = distri.log_prob(action.squeeze(-1)).unsqueeze(-1)
    entropy = distri.entropy().unsqueeze(-1)
    return action_log, entropy


def continuous_autoregreesive_act(decoder, obs_rep, obs, batch_size, n_agent, action_dim, tpdv,
                                  deterministic=False):
    shifted_action = torch.zeros((batch_size, n_agent, action_dim)).to(**tpdv)
    output_action = torch.zeros((batch_size, n_agent, action_dim), dtype=torch.float32)
    output_action_log = torch.zeros_like(output_action, dtype=torch.float32)

    for i in range(n_agent):
        act_mean = decoder(shifted_action, obs_rep, obs)[:, i, :]
        action_std = torch.sigmoid(decoder.log_std) * 0.5

        # log_std = torch.zeros_like(act_mean).to(**tpdv) + decoder.log_std
        # distri = Normal(act_mean, log_std.exp())
        distri = Normal(act_mean, action_std)
        action = act_mean if deterministic else distri.sample()
        action_log = distri.log_prob(action)

        output_action[:, i, :] = action
        output_action_log[:, i, :] = action_log
        if i + 1 < n_agent:
            shifted_action[:, i + 1, :] = action

        # print("act_mean: ", act_mean)
        # print("action: ", action)

    return output_action, output_action_log


def continuous_parallel_act(decoder, obs_rep, obs, action, batch_size, n_agent, action_dim, tpdv):
    shifted_action = torch.zeros((batch_size, n_agent, action_dim)).to(**tpdv)
    shifted_action[:, 1:, :] = action[:, :-1, :]

    act_mean = decoder(shifted_action, obs_rep, obs)
    action_std = torch.sigmoid(decoder.log_std) * 0.5
    distri = Normal(act_mean, action_std)

    # log_std = torch.zeros_like(act_mean).to(**tpdv) + decoder.log_std
    # distri = Normal(act_mean, log_std.exp())

    action_log = distri.log_prob(action)
    entropy = distri.entropy()
    return action_log, entropy

```

### Core Architecture Module: `onpolicy/algorithms/utils/util.py`
```
import copy
import numpy as np

import torch
import torch.nn as nn

def init(module, weight_init, bias_init, gain=1):
    weight_init(module.weight.data, gain=gain)
    if module.bias is not None:
        bias_init(module.bias.data)
    return module

def get_clones(module, N):
    return nn.ModuleList([copy.deepcopy(module) for i in range(N)])

def check(input):
    output = torch.from_numpy(input) if type(input) == np.ndarray else input
    return output

```

### Core Architecture Module: `onpolicy/envs/hanabi/hanabi_lib/hanabi_state.h`
```
// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef __HANABI_STATE_H__
#define __HANABI_STATE_H__

#include <random>
#include <string>
#include <vector>

#include "hanabi_card.h"
#include "hanabi_game.h"
#include "hanabi_hand.h"
#include "hanabi_history_item.h"
#include "hanabi_move.h"

namespace hanabi_learning_env {

constexpr int kChancePlayerId = -1;

class HanabiState {
 public:
  class HanabiDeck {
   public:
    explicit HanabiDeck(const HanabiGame& game);
    // DealCard returns invalid card on failure.
    HanabiCard DealCard(int color, int rank);
    HanabiCard DealCard(std::mt19937* rng);
    int Size() const { return total_count_; }
    bool Empty() const { return total_count_ == 0; }
    int CardCount(int color, int rank) const {
      return card_count_[CardToIndex(color, rank)];
    }

   private:
    int CardToIndex(int color, int rank) const {
      return color * num_ranks_ + rank;
    }
    int IndexToColor(int index) const { return index / num_ranks_; }
    int IndexToRank(int index) const { return index % num_ranks_; }

    // Number of instances in the deck for each card.
    // E.g., if card_count_[CardToIndex(card)] == 2, then there are two
    // instances of card remaining in the deck, available to be dealt out.
    std::vector<int> card_count_;
    int total_count_ = -1;  // Total number of cards available to be dealt out.
    int num_ranks_ = -1;    // From game.NumRanks(), used to map card to index.
  };

  enum EndOfGameType {
    kNotFinished,        // Not the end of game.
    kOutOfLifeTokens,    // Players ran out of life tokens.
    kOutOfCards,         // Players ran out of cards.
    kCompletedFireworks  // All fireworks played.
  };

  // Construct a HanabiState, initialised to the start of the game.
  // If start_player >= 0, the game-provided start player is overridden
  // and the first player after chance is start_player.
  explicit HanabiState(const HanabiGame* parent_game, int start_player = -1);
  // Copy constructor for recursive game traversals using copy + apply-move.
  HanabiState(const HanabiState& state) = default;

  bool MoveIsLegal(HanabiMove move) const;
  void ApplyMove(HanabiMove move);
  // Legal moves for state. Moves point into an unchanging list in parent_game.
  std::vector<HanabiMove> LegalMoves(int player) const;
  // Returns true if card with color and rank can be played on fireworks pile.
  bool CardPlayableOnFireworks(int color, int rank) const;
  bool CardPlayableOnFireworks(HanabiCard card) const {
    return CardPlayableOnFireworks(card.Color(), card.Rank());
  }
  bool ChanceOutcomeIsLegal(HanabiMove move) const { return MoveIsLegal(move); }
  double ChanceOutcomeProb(HanabiMove move) const;
  void ApplyChanceOutcome(HanabiMove move) { ApplyMove(move); }
  void ApplyRandomChance();
  // Get the valid chance moves, and associated probabilities.
  // Guaranteed that moves.size() == probabilities.size().
  std::pair<std::vector<HanabiMove>, std::vector<double>> ChanceOutcomes()
      const;
  EndOfGameType EndOfGameStatus() const;
  bool IsTerminal() const { return EndOfGameStatus() != kNotFinished; }
  int Score() const;
  std::string ToString() const;

  int CurPlayer() const { return cur_player_; }
  int LifeTokens() const { return life_tokens_; }
  int InformationTokens() const { return information_tokens_; }
  const std::vector<HanabiHand>& Hands() const { return hands_; }
  const std::vector<int>& Fireworks() const { return fireworks_; }
  const HanabiGame* ParentGame() const { return parent_game_; }
  const HanabiDeck& Deck() const { return deck_; }
  // Get the discard pile (the element at the back is the most recent discard.)
  const std::vector<HanabiCard>& DiscardPile() const { return discard_pile_; }
  // Sequence of moves from beginning of game. Stored as <move, actor>.
  const std::vector<HanabiHistoryItem>& MoveHistory() const {
    return move_history_;
  }

 private:
  // Add card to table if possible, if not lose a life token.
  // Returns <scored,information_token_added>
  // success is true iff card was successfully added to fireworks.
  // information_token_added is true iff information_tokens increase
  // (i.e., success=true, highest rank was added, and not at max tokens.)
  std::pair<bool, bool> AddToFireworks(HanabiCard card);
  const HanabiHand& HandByOffset(int offset) const {
    return hands_[(cur_player_ + offset) % hands_.size()];
  }
  HanabiHand* HandByOffset(int offset) {
    return &hands_[(cur_player_ + offset) % hands_.size()];
  }
  void AdvanceToNextPlayer();  // Set cur_player to next player to act.
  bool HintingIsLegal(HanabiMove move) const;
  int PlayerToDeal() const;  // -1 if no player needs a card.
  bool IncrementInformationTokens();
  void DecrementInformationTokens();
  void DecrementLifeTokens();

  const HanabiGame* parent_game_ = nullptr;
  HanabiDeck deck_;
  // Back element of discard_pile_ is most recently discarded card.
  std::vector<HanabiCard> discard_pile_;
  std::vector<HanabiHand> hands_;
  std::vector<HanabiHistoryItem> move_history_;
  int cur_player_ = -1;
  int next_non_chance_player_ = -1;  // Next non-chance player to act.
  int information_tokens_ = -1;
  int life_tokens_ = -1;
  std::vector<int> fireworks_;
  int turns_to_play_ = -1;  // Number of turns to play once deck is empty.
};

}  // namespace hanabi_learning_env

#endif

```

### Core Architecture Module: `onpolicy/envs/hanabi/hanabi_lib/util.h`
```
// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef __UTIL_H__
#define __UTIL_H__

#include <cassert>
#include <cstdlib>
#include <string>
#include <unordered_map>

namespace hanabi_learning_env {

constexpr int kMaxNumColors = 5;
constexpr int kMaxNumRanks = 5;

// Returns a character representation of an integer color/rank index.
char ColorIndexToChar(int color);
char RankIndexToChar(int rank);

// Returns string associated with key in params, parsed as template type.
// If key is not in params, returns the provided default value.
template <class T>
T ParameterValue(const std::unordered_map<std::string, std::string>& params,
                 const std::string& key, T default_value);

template <>
int ParameterValue(const std::unordered_map<std::string, std::string>& params,
                   const std::string& key, int default_value);
template <>
double ParameterValue(
    const std::unordered_map<std::string, std::string>& params,
    const std::string& key, double default_value);
template <>
std::string ParameterValue(
    const std::unordered_map<std::string, std::string>& params,
    const std::string& key, std::string default_value);
template <>
bool ParameterValue(const std::unordered_map<std::string, std::string>& params,
                    const std::string& key, bool default_value);

#if defined(NDEBUG)
#define REQUIRE(expr)                                                        \
  (expr ? (void)0                                                            \
        : (fprintf(stderr, "Input requirements failed at %s:%d in %s: %s\n", \
                   __FILE__, __LINE__, __func__, #expr),                     \
           std::abort()))
#else
#define REQUIRE(expr) assert(expr)
#endif

}  // namespace hanabi_learning_env

#endif

```

### Core Architecture Module: `onpolicy/envs/mpe/core.py`
```
import numpy as np
import seaborn as sns

# physical/external base state of all entites
class EntityState(object):
    def __init__(self):
        # physical position
        self.p_pos = None
        # physical velocity
        self.p_vel = None

# state of agents (including communication and internal/mental state)
class AgentState(EntityState):
    def __init__(self):
        super(AgentState, self).__init__()
        # communication utterance
        self.c = None

# action of the agent
class Action(object):
    def __init__(self):
        # physical action
        self.u = None
        # communication action
        self.c = None

# properties of wall entities
class Wall(object):
    def __init__(self, orient='H', axis_pos=0.0, endpoints=(-1, 1), width=0.1,
                 hard=True):
        # orientation: 'H'orizontal or 'V'ertical
        self.orient = orient
        # position along axis which wall lays on (y-axis for H, x-axis for V)
        self.axis_pos = axis_pos
        # endpoints of wall (x-coords for H, y-coords for V)
        self.endpoints = np.array(endpoints)
        # width of wall
        self.width = width
        # whether wall is impassable to all agents
        self.hard = hard
        # color of wall
        self.color = np.array([0.0, 0.0, 0.0])


# properties and state of physical world entity
class Entity(object):
    def __init__(self):
        # index among all entities (important to set for distance caching)
        self.i = 0
        # name
        self.name = ''
        # properties:
        self.size = 0.050
        # entity can move / be pushed
        self.movable = False
        # entity collides with others
        self.collide = True
        # entity can pass through non-hard walls
        self.ghost = False
        # material density (affects mass)
        self.density = 25.0
        # color
        self.color = None
        # max speed and accel
        self.max_speed = None
        self.accel = None
        # state: including internal/mental state p_pos, p_vel
        self.state = EntityState()
        # mass
        self.initial_mass = 1.0
        # commu channel
        self.channel = None

    @property
    def mass(self):
        return self.initial_mass

# properties of landmark entities
class Landmark(Entity):
    def __init__(self):
        super(Landmark, self).__init__()

# properties of agent entities
class Agent(Entity):
    def __init__(self):
        super(Agent, self).__init__()
        # agent are adversary
        self.adversary = False
        # agent are dummy
        self.dummy = False
        # agents are movable by default
        self.movable = True
        # cannot send communication signals
        self.silent = False
        # cannot observe the world
        self.blind = False
        # physical motor noise amount
        self.u_noise = None
        # communication noise amount
        self.c_noise = None
        # control range
        self.u_range = 1.0
        # state: including communication state(communication utterance) c and internal/mental state p_pos, p_vel
        self.state = AgentState()
        # action: physical action u & communication action c
        self.action = Action()
        # script behavior to execute
        self.action_callback = None
        # zoe 20200420
        self.goal = None

# multi-agent world
class World(object):
    def __init__(self):
        # list of agents and entities (can change at execution-time!)
        self.agents = []
        self.landmarks = []
        self.walls = []
        # communication channel dimensionality
        self.dim_c = 0
        # position dimensionality
        self.dim_p = 2
        # color dimensionality
        self.dim_color = 3
        # simulation timestep
        self.dt = 0.1
        # physical damping（阻尼）
        self.damping = 0.25
        # contact response parameters
        self.contact_force = 1e+2
        self.contact_margin = 1e-3
        # cache distances between all agents (not calculated by default)
        self.cache_dists = False
        self.cached_dist_vect = None
        self.cached_dist_mag = None
        # zoe 20200420
        self.world_length = 25
        self.world_step = 0
        self.num_agents = 0
        self.num_landmarks = 0

    # return all entities in the world
    @property
    def entities(self):
        return self.agents + self.landmarks

    # return all agents controllable by external policies
    @property
    def policy_agents(self):
        return [agent for agent in self.agents if agent.action_callback is None]

    # return all agents controlled by world scripts
    @property
    def scripted_agents(self):
        return [agent for agent in self.agents if agent.action_callback is not None]

    def calculate_distances(self):
        if self.cached_dist_vect is None:
            # initialize distance data structure
            self.cached_dist_vect = np.zeros((len(self.entities),
                                              len(self.entities),
                                              self.dim_p))
            # calculate minimum distance for a collision between all entities （size相加�?
            self.min_dists = np.zeros((len(self.entities), len(self.entities)))
            for ia, entity_a in enumerate(self.entities):
                for ib in range(ia + 1, len(self.entities)):
                    entity_b = self.entities[ib]
                    min_dist = entity_a.size + entity_b.size
                    self.min_dists[ia, ib] = min_dist
                    self.min_dists[ib, ia] = min_dist

        for ia, entity_a in enumerate(self.entities):
            for ib in range(ia + 1, len(self.entities)):
                entity_b = self.entities[ib]
                delta_pos = entity_a.state.p_pos - entity_b.state.p_pos
                self.cached_dist_vect[ia, ib, :] = delta_pos
                self.cached_dist_vect[ib, ia, :] = -delta_pos

        self.cached_dist_mag = np.linalg.norm(self.cached_dist_vect, axis=2)

        self.cached_collisions = (self.cached_dist_mag <= self.min_dists)

    def assign_agent_colors(self):
        n_dummies = 0
        if hasattr(self.agents[0], 'dummy'):
            n_dummies = len([a for a in self.agents if a.dummy])
        n_adversaries = 0
        if hasattr(self.agents[0], 'adversary'):
            n_adversaries = len([a for a in self.agents if a.adversary])
        n_good_agents = len(self.agents) - n_adversaries - n_dummies
        # r g b
        dummy_colors = [(0.25, 0.75, 0.25)] * n_dummies
        # sns.color_palette("OrRd_d", n_adversaries)
        adv_colors = [(0.75, 0.25, 0.25)] * n_adversaries
        # sns.color_palette("GnBu_d", n_good_agents)
        good_colors = [(0.25, 0.25, 0.75)] * n_good_agents
        colors = dummy_colors + adv_colors + good_colors
        for color, agent in zip(colors, self.agents):
            agent.color = color

    # landmark color
    def assign_landmark_colors(self):
        for landmark in self.landmarks:
            landmark.color = np.array([0.25, 0.25, 0.25])

    # update state of the world
    def step(self):
        # zoe 20200420
        self.world_step += 1
        # set actions for scripted agents
        for agent in self.scripted_agents:
            agent.action = agent.action_callback(agent, self)
        # gather forces applied to entities
        p_force = [None] * len(self.entities)
        # apply agent physical controls
        p_force = self.apply_action_force(p_force)
        # apply environment forces
        p_force = self.apply_environment_force(p_force)
        # integrate physical state
        self.integrate_state(p_force)
        # update agent state
        for agent in self.agents:
            self.update_agent_state(agent)
        # calculate and store distances between all entities
        if self.cache_dists:
            self.calculate_distances()

    # gather agent action forces
    def apply_action_force(self, p_force):
        # set applied forces
        for i, agent in enumerate(self.agents):
            if agent.movable:
                noise = np.random.randn(
                    *agent.action.u.shape) * agent.u_noise if agent.u_noise else 0.0
                # force = mass * a * action + n
                p_force[i] = (
                    agent.mass * agent.accel if agent.accel is not None else agent.mass) * agent.action.u + noise
        return p_force

    # gather physical forces acting on entities
    def apply_environment_force(self, p_force):
        # simple (but inefficient) collision response
        for a, entity_a in enumerate(self.entities):
            for b, entity_b in enumerate(self.entities):
                if(b <= a):
                    continue
                [f_a, f_b] = self.get_entity_collision_force(a, b)
                if(f_a is not None):
                    if(p_force[a] is None):
                        p_force[a] = 0.0
                    p_force[a] = f_a + p_force[a]
                if(f_b is not None):
                    if(p_force[b] is None):
                        p_force[b] = 0.0
                    p_force[b] = f_b + p_force[b]
            if entity_a.movable:
                for wall in self.walls:
                    wf = self.get_wall_collision_force(entity_a, wall)
                    if wf is not None:
                        if p_force[a] is None:
                            p_force[a] = 0.0
                        p_force[a] = p_force[a] + wf
        return p_force

    def integrate_state(self, p_force):
        for i, entity in enumerate(self.entities):
            if not entity.movable:
                continue
            entity.state.p_vel = entity.state.p_vel * (1 - self.damping)
            if (p_force[i] is not None):
                entity.state.p_vel += (p_force[i] / entity.mass) * self.dt
            if entity.max_speed is not None:
                speed = np.sqrt(
                    np.square(entity.state.p_vel[0]) + np.square(entity
```

### Core Architecture Module: `onpolicy/envs/mpe/rendering.py`
```
"""
2D rendering framework
"""
from __future__ import division
import os
import six
import sys

if "Apple" in sys.version:
    if 'DYLD_FALLBACK_LIBRARY_PATH' in os.environ:
        os.environ['DYLD_FALLBACK_LIBRARY_PATH'] += ':/usr/lib'
        # (JDS 2016/04/15): avoid bug on Anaconda 2.3.0 / Yosemite

from gym import error

try:
    import pyglet
except ImportError as e:
    print(suffix="HINT: you can install pyglet directly via 'pip install pyglet'. But if you really just want to install all Gym dependencies and not have to think about it, 'pip install -e .[all]' or 'pip install gym[all]' will do it.")

try:
    from pyglet.gl import *
except ImportError as e:
    print(prefix="Error occured while running `from pyglet.gl import *`",suffix="HINT: make sure you have OpenGL install. On Ubuntu, you can run 'apt-get install python-opengl'. If you're running on a server, you may need a virtual frame buffer; something like this should work: 'xvfb-run -s \"-screen 0 1400x900x24\" python <your_script.py>'")

import math
import numpy as np

RAD2DEG = 57.29577951308232

def get_display(spec):
    """Convert a display specification (such as :0) into an actual Display
    object.

    Pyglet only supports multiple Displays on Linux.
    """
    if spec is None:
        return None
    elif isinstance(spec, six.string_types):
        return pyglet.canvas.Display(spec)
    else:
        raise error.Error('Invalid display specification: {}. (Must be a string like :0 or None.)'.format(spec))

class Viewer(object):
    def __init__(self, width, height, display=None):
        display = get_display(display)

        self.width = width
        self.height = height

        self.window = pyglet.window.Window(width=width, height=height, display=display)
        self.window.on_close = self.window_closed_by_user
        self.geoms = []
        self.onetime_geoms = []
        self.transform = Transform()

        glEnable(GL_BLEND)
        # glEnable(GL_MULTISAMPLE)
        glEnable(GL_LINE_SMOOTH)
        # glHint(GL_LINE_SMOOTH_HINT, GL_DONT_CARE)
        glHint(GL_LINE_SMOOTH_HINT, GL_NICEST)
        glLineWidth(2.0)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)

    def close(self):
        self.window.close()

    def window_closed_by_user(self):
        self.close()

    def set_bounds(self, left, right, bottom, top):
        assert right > left and top > bottom
        scalex = self.width/(right-left)
        scaley = self.height/(top-bottom)
        self.transform = Transform(
            translation=(-left*scalex, -bottom*scaley),
            scale=(scalex, scaley))

    def add_geom(self, geom):
        self.geoms.append(geom)

    def add_onetime(self, geom):
        self.onetime_geoms.append(geom)

    def render(self, return_rgb_array=False):
        glClearColor(1,1,1,1)
        self.window.clear()
        self.window.switch_to()
        self.window.dispatch_events()
        self.transform.enable()
        for geom in self.geoms:
            geom.render()
        for geom in self.onetime_geoms:
            geom.render()
        self.transform.disable()
        arr = None
        if return_rgb_array:
            buffer = pyglet.image.get_buffer_manager().get_color_buffer()
            image_data = buffer.get_image_data()
            arr = np.fromstring(image_data.get_data(), dtype=np.uint8, sep='')
            # In https://github.com/openai/gym-http-api/issues/2, we
            # discovered that someone using Xmonad on Arch was having
            # a window of size 598 x 398, though a 600 x 400 window
            # was requested. (Guess Xmonad was preserving a pixel for
            # the boundary.) So we use the buffer height/width rather
            # than the requested one.
            arr = arr.reshape(buffer.height, buffer.width, 4)
            arr = arr[::-1,:,0:3]
        self.window.flip()
        self.onetime_geoms = []
        return arr

    # Convenience
    def draw_circle(self, radius=10, res=30, filled=True, **attrs):
        geom = make_circle(radius=radius, res=res, filled=filled)
        _add_attrs(geom, attrs)
        self.add_onetime(geom)
        return geom

    def draw_polygon(self, v, filled=True, **attrs):
        geom = make_polygon(v=v, filled=filled)
        _add_attrs(geom, attrs)
        self.add_onetime(geom)
        return geom

    def draw_polyline(self, v, **attrs):
        geom = make_polyline(v=v)
        _add_attrs(geom, attrs)
        self.add_onetime(geom)
        return geom

    def draw_line(self, start, end, **attrs):
        geom = Line(start, end)
        _add_attrs(geom, attrs)
        self.add_onetime(geom)
        return geom

    def get_array(self):
        self.window.flip()
        image_data = pyglet.image.get_buffer_manager().get_color_buffer().get_image_data()
        self.window.flip()
        arr = np.fromstring(image_data.data, dtype=np.uint8, sep='')
        arr = arr.reshape(self.height, self.width, 4)
        return arr[::-1,:,0:3]

def _add_attrs(geom, attrs):
    if "color" in attrs:
        geom.set_color(*attrs["color"])
    if "linewidth" in attrs:
        geom.set_linewidth(attrs["linewidth"])

class Geom(object):
    def __init__(self):
        self._color=Color((0, 0, 0, 1.0))
        self.attrs = [self._color]
    def render(self):
        for attr in reversed(self.attrs):
            attr.enable()
        self.render1()
        for attr in self.attrs:
            attr.disable()
    def render1(self):
        raise NotImplementedError
    def add_attr(self, attr):
        self.attrs.append(attr)
    def set_color(self, r, g, b, alpha=1):
        self._color.vec4 = (r, g, b, alpha)

class Attr(object):
    def enable(self):
        raise NotImplementedError
    def disable(self):
        pass

class Transform(Attr):
    def __init__(self, translation=(0.0, 0.0), rotation=0.0, scale=(1,1)):
        self.set_translation(*translation)
        self.set_rotation(rotation)
        self.set_scale(*scale)
    def enable(self):
        glPushMatrix()
        glTranslatef(self.translation[0], self.translation[1], 0) # translate to GL loc ppint
        glRotatef(RAD2DEG * self.rotation, 0, 0, 1.0)
        glScalef(self.scale[0], self.scale[1], 1)
    def disable(self):
        glPopMatrix()
    def set_translation(self, newx, newy):
        self.translation = (float(newx), float(newy))
    def set_rotation(self, new):
        self.rotation = float(new)
    def set_scale(self, newx, newy):
        self.scale = (float(newx), float(newy))

class Color(Attr):
    def __init__(self, vec4):
        self.vec4 = vec4
    def enable(self):
        glColor4f(*self.vec4)

class LineStyle(Attr):
    def __init__(self, style):
        self.style = style
    def enable(self):
        glEnable(GL_LINE_STIPPLE)
        glLineStipple(1, self.style)
    def disable(self):
        glDisable(GL_LINE_STIPPLE)

class LineWidth(Attr):
    def __init__(self, stroke):
        self.stroke = stroke
    def enable(self):
        glLineWidth(self.stroke)

class Point(Geom):
    def __init__(self):
        Geom.__init__(self)
    def render1(self):
        glBegin(GL_POINTS) # draw point
        glVertex3f(0.0, 0.0, 0.0)
        glEnd()

class FilledPolygon(Geom):
    def __init__(self, v):
        Geom.__init__(self)
        self.v = v
    def render1(self):
        if   len(self.v) == 4 : glBegin(GL_QUADS)
        elif len(self.v)  > 4 : glBegin(GL_POLYGON)
        else: glBegin(GL_TRIANGLES)
        for p in self.v:
            glVertex3f(p[0], p[1],0)  # draw each vertex
        glEnd()

        color = (self._color.vec4[0] * 0.5, self._color.vec4[1] * 0.5, self._color.vec4[2] * 0.5, self._color.vec4[3] * 0.5)
        glColor4f(*color)
        glBegin(GL_LINE_LOOP)
        for p in self.v:
            glVertex3f(p[0], p[1],0)  # draw each vertex
        glEnd()

def make_circle(radius=10, res=30, filled=True):
    points = []
    for i in range(res):
        ang = 2*math.pi*i / res
        points.append((math.cos(ang)*radius, math.sin(ang)*radius))
    if filled:
        return FilledPolygon(points)
    else:
        return PolyLine(points, True)

def make_polygon(v, filled=True):
    if filled: return FilledPolygon(v)
    else: return PolyLine(v, True)

def make_polyline(v):
    return PolyLine(v, False)

def make_capsule(length, width):
    l, r, t, b = 0, length, width/2, -width/2
    box = make_polygon([(l,b), (l,t), (r,t), (r,b)])
    circ0 = make_circle(width/2)
    circ1 = make_circle(width/2)
    circ1.add_attr(Transform(translation=(length, 0)))
    geom = Compound([box, circ0, circ1])
    return geom

class Compound(Geom):
    def __init__(self, gs):
        Geom.__init__(self)
        self.gs = gs
        for g in self.gs:
            g.attrs = [a for a in g.attrs if not isinstance(a, Color)]
    def render1(self):
        for g in self.gs:
            g.render()

class PolyLine(Geom):
    def __init__(self, v, close):
        Geom.__init__(self)
        self.v = v
        self.close = close
        self.linewidth = LineWidth(1)
        self.add_attr(self.linewidth)
    def render1(self):
        glBegin(GL_LINE_LOOP if self.close else GL_LINE_STRIP)
        for p in self.v:
            glVertex3f(p[0], p[1],0)  # draw each vertex
        glEnd()
    def set_linewidth(self, x):
        self.linewidth.stroke = x

class Line(Geom):
    def __init__(self, start=(0.0, 0.0), end=(0.0, 0.0)):
        Geom.__init__(self)
        self.start = start
        self.end = end
        self.linewidth = LineWidth(1)
        self.add_attr(self.linewidth)

    def render1(self):
        glBegin(GL_LINES)
        glVertex2f(*self.start)
        glVertex2f(*self.end)
        glEnd()

class Image(Geom):
    def __init__(self, fname, width, height):
        Geom.__init__(self)
        self.width = width
        self.height = height
        img = pyglet.image.load(fname)
        self.img = img
        self.flip = False
    def render1(self):
        self.img.blit(-self.width/2, -self.
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

### Incident Patch 7: `040ac17d` (2021-04-23)
**Commit Message**: add render code for mpe, fyi

**File**: `onpolicy/scripts/render/render_mpe.py` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
+#!/usr/bin/env python
+import sys
+import os
+import wandb
+import socket
+import setproctitle
+import numpy as np
+from pathlib import Path
+
+import torch
+
+from onpolicy.config import get_config
+
+from onpolicy.envs.mpe.MPE_env import MPEEnv
+from onpolicy.envs.env_wrappers import SubprocVecEnv, DummyVecEnv
+
+def make_render_env(all_args):
+    def get_env_fn(rank):
+        def init_env():
+            if all_args.env_name == "MPE":
+                env = MPEEnv(all_args)
+            else:
+                print("Can not support the " +
+                      all_args.env_name + "environment.")
+                raise NotImplementedError
+            env.seed(all_args.seed + rank * 1000)
+            return env
+        return init_env
+    if all_args.n_rollout_threads == 1:
+        return DummyVecEnv([get_env_fn(0)])
+    else:
+        return SubprocVecEnv([get_env_fn(i) for i in range(all_args.n_rollout_threads)])
+
+def parse_args(args, parser):
+    parser.add_argument('--scenario_name', type=str,
+                        default='simple_spread', help="Which scenario to run on")
+    parser.add_argument("--num_landmarks", type=int, default=3)
+    parser.add_argument('--num_agents', type=int,
+                        default=2, help="number of players")
+
+    all_args = parser.parse_known_args(args)[0]
+
+    return all_args
+
+
+def main(args):
+    parser = get_config()
+    all_args = parse_args(args, parser)
+
+    if all_args.algorithm_name == "rmappo" or all_args.algorithm_name == "rmappg":
+        assert (
+            all_args.use_recurrent_policy or all_args.use_naive_recurrent_policy), ("check recurrent policy!")
+    elif all_args.algorithm_name == "mappo" or all_args.algorithm_name == "mappg":
+        assert (all_args.use_recurrent_policy and all_args.use_naive_recurrent_policy) == False, (
+            "check recurrent policy!")
+    else:
+        raise NotImplementedError
+
+    assert (all_args.share_policy == True and all_args.scenario_name == 'simple_speaker_listener') == False, (
+        "The simple_speaker_listener scenario can not use shared policy. Please check the config.py.")
+
+    assert all_args.use_render, ("u need to set use_render be True")
+    assert not (all_args.model_dir == None or all_args.model_dir == ""), ("set model_dir first")
+    assert all_args.n_rollout_threads==1, ("only support to use 1 env to render.")
+    
+    # cuda
+    if all_args.cuda and torch.cuda.is_available():
+        print("choose to use gpu...")
+        device = torch.device("cuda:0")
+        torch.set_num_threads(all_args.n_training_threads)
+        if all_args.cuda_deterministic:
+            torch.backends.cudnn.benchmark = False
+            torch.backends.cudnn.deterministic = True
+    else:
+        print("choose to use cpu...")
+        device = torch.device("cpu")
+        torch.set_num_threads(all_args.n_training_threads)
+
+    # run dir
+    run_dir = Path(os.path.split(os.path.dirname(os.path.abspath(__file__)))[0] + "/results") / all_args.env_name / all_args.scenario_name / all_args.algorithm_name / all_args.experiment_name
+    if not run_dir.exists():
+        os.makedirs(str(run_dir))
+
+    if not run_dir.exists():
+        curr_run = 'run1'
+    else:
+        exst_run_nums = [int(str(folder.name).split('run')[1]) for folder in run_dir.iterdir() if str(folder.name).startswith('run')]
+        if len(exst_run_nums) == 0:
+            curr_run = 'run1'
+        else:
+            curr_run = 'run%i' % (max(exst_run_nums) + 1)
+    run_dir = run_dir / curr_run
+    if not run_dir.exists():
+        os.makedirs(str(run_dir))
+
+    setproctitle.setproctitle(str(all_args.algorithm_name) + "-" + \
+        str(all_args.env_name) + "-" + str(all_args.experiment_name) + "@" + str(all_args.user_name))
+
+    # seed
+    torch.manual_seed(all_args.seed)
+    torch.cuda.manual_seed_all(all_args.seed)
+    np.random.seed(all_args.seed)
+
+    # env init
+    envs = make_render_env(all_args)
+    eval_envs = None
+    num_agents = all_args.num_agents
+
+    config = {
+        "all_args": all_args,
+        "envs": envs,
+        "eval_envs": eval_envs,
+        "num_agents": num_agents,
+        "device": device,
+        "run_dir": run_dir
+    }
+
+    # run experiments
+    if all_args.share_policy:
+        from onpolicy.runner.shared.mpe_runner import MPERunner as Runner
+    else:
+        from onpolicy.runner.separated.mpe_runner import MPERunner as Runner
+
+    runner = Runner(config)
+    runner.render()
+    
+    # post process
+    envs.close()
+
+if __name__ == "__main__":
+    main(sys.argv[1:])
```

**File**: `onpolicy/scripts/render_mpe.sh` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+#!/bin/sh
+env="MPE"
+scenario="simple_speaker_listener"
+num_landmarks=3
+num_agents=2
+algo="rmappo"
+exp="check"
+seed_max=1
+
+echo "env is ${env}"
+for seed in `seq ${seed_max}`
+do
+    CUDA_VISIBLE_DEVICES=1 python render/render_mpe.py --save_gifs --share_policy --env_name ${env} --algorithm_name ${algo} --experiment_name ${exp} --scenario_name ${scenario} --num_agents ${num_agents} --num_landmarks ${num_landmarks} --seed ${seed} --n_training_threads 1 --n_rollout_threads 1 --use_render --episode_length 25 --render_episodes 5 --model_dir "/home/yuchao/project/xxxx"
+done
```

---

### Incident Patch 8: `b5c1e75c` (2021-04-23)
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

**File**: `onpolicy/scripts/train/train_smac.py` (modified, +2/-2)
```diff
@@ -62,9 +62,9 @@ def parse_args(args, parser):
     parser.add_argument("--add_agent_id", action='store_true', default=False)
     parser.add_argument("--add_visible_state", action='store_true', default=False)
     parser.add_argument("--add_xy_state", action='store_true', default=False)
-    parser.add_argument("--use_state_agent", action='store_true', default=False)
+    parser.add_argument("--use_state_agent", action='store_false', default=True)
     parser.add_argument("--use_mustalive", action='store_false', default=True)
-    parser.add_argument("--add_center_xy", action='store_true', default=False)
+    parser.add_argument("--add_center_xy", action='store_false', default=True)
 
     all_args = parser.parse_known_args(args)[0]
 
```

**File**: `onpolicy/scripts/train_mpe.sh` (modified, +3/-3)
```diff
@@ -1,15 +1,15 @@
 #!/bin/sh
 env="MPE"
-scenario="simple_spread"  # simple_speaker_listener # simple_spread
+scenario="simple_spread"  # simple_speaker_listener # simple_reference
 num_landmarks=3
 num_agents=3
 algo="rmappo"
-exp="rnn_mini4"
+exp="check"
 seed_max=1
 
 echo "env is ${env}, scenario is ${scenario}, algo is ${algo}, exp is ${exp}, max seed is ${seed_max}"
 for seed in `seq ${seed_max}`;
 do
     echo "seed is ${seed}:"
-    CUDA_VISIBLE_DEVICES=1 python train/train_mpe.py --env_name ${env} --algorithm_name ${algo} --experiment_name ${exp} --scenario_name ${scenario} --num_agents ${num_agents} --num_landmarks ${num_landmarks} --seed 50 --n_training_threads 127 --n_rollout_threads 128 --num_mini_batch 1 --episode_length 25 --num_env_steps 2000000 --ppo_epoch 10 --gain 0.01 --lr 7e-4 --critic_lr 7e-4 --use_wandb
+    CUDA_VISIBLE_DEVICES=0 python train/train_mpe.py --use_valuenorm --use_popart --env_name ${env} --algorithm_name ${algo} --experiment_name ${exp} --scenario_name ${scenario} --num_agents ${num_agents} --num_landmarks ${num_landmarks} --seed ${seed} --n_training_threads 1 --n_rollout_threads 128 --num_mini_batch 1 --episode_length 25 --num_env_steps 20000000 --ppo_epoch 10 --use_ReLU --gain 0.01 --lr 7e-4 --critic_lr 7e-4 --wandb_name "zoeyuchao" --user_name "zoeyuchao"
 done
\ No newline at end of file
```

**File**: `onpolicy/scripts/train_smac.sh` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@ echo "env is ${env}, map is ${map}, algo is ${algo}, exp is ${exp}, max seed is
 for seed in `seq ${seed_max}`;
 do
     echo "seed is ${seed}:"
-    CUDA_VISIBLE_DEVICES=1 python train/train_smac.py --env_name ${env} --algorithm_name ${algo} --experiment_name ${exp} --map_name ${map} --seed 50 --n_training_threads 127 --n_rollout_threads 8 --num_mini_batch 1 --episode_length 400 --num_env_steps 10000000 --ppo_epoch 5 --use_value_active_masks --use_eval --add_center_xy --use_wandb --use_state_agent --use_recurrent_policy
+    CUDA_VISIBLE_DEVICES=1 python train/train_smac.py --env_name ${env} --algorithm_name ${algo} --experiment_name ${exp} --map_name ${map} --seed ${seed} --n_training_threads 127 --n_rollout_threads 8 --num_mini_batch 1 --episode_length 400 --num_env_steps 10000000 --ppo_epoch 5 --use_value_active_masks --use_eval --use_recurrent_policy
 done
```

---

### Incident Patch 9: `4f97d7ff` (2021-04-21)
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

### Incident Patch 10: `59ad96b3` (2021-03-09)
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
