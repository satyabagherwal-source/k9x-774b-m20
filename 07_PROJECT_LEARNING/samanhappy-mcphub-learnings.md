# Forensic Learning Record (Deep Inspection): samanhappy/mcphub

> **Canonical Artifact**: `07_PROJECT_LEARNING/samanhappy-mcphub-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/samanhappy/mcphub](https://github.com/samanhappy/mcphub))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:10:44.526Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `samanhappy/mcphub`
- **Description**: Self-hosted MCP gateway and control plane for connecting, controlling, and operating MCP servers.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2495 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `frontend/src/hooks/useBuiltinPromptData.ts`
```
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BuiltinPrompt } from '@/types';
import {
  getBuiltinPrompts,
  createBuiltinPrompt,
  updateBuiltinPrompt,
  deleteBuiltinPrompt,
} from '@/services/builtinPromptService';

export const useBuiltinPromptData = () => {
  const { t } = useTranslation();
  const [prompts, setPrompts] = useState<BuiltinPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBuiltinPrompts();
      setPrompts(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching built-in prompts:', err);
      setError(err instanceof Error ? err.message : t('builtinPrompts.fetchError'));
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const addPrompt = async (prompt: Omit<BuiltinPrompt, 'id'>) => {
    try {
      const result = await createBuiltinPrompt(prompt);
      triggerRefresh();
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : t('builtinPrompts.createError');
      setError(message);
      return { success: false, message };
    }
  };

  const editPrompt = async (id: string, prompt: Partial<BuiltinPrompt>) => {
    try {
      const result = await updateBuiltinPrompt(id, prompt);
      triggerRefresh();
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : t('builtinPrompts.updateError');
      setError(message);
      return { success: false, message };
    }
  };

  const removePrompt = async (id: string) => {
    try {
      await deleteBuiltinPrompt(id);
      triggerRefresh();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : t('builtinPrompts.deleteError');
      setError(message);
      return { success: false, message };
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts, refreshKey]);

  return {
    prompts,
    loading,
    error,
    setError,
    triggerRefresh,
    addPrompt,
    editPrompt,
    removePrompt,
  };
};

```

### Core Architecture Module: `frontend/src/hooks/useBuiltinResourceData.ts`
```
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BuiltinResource } from '@/types';
import {
  getBuiltinResources,
  createBuiltinResource,
  updateBuiltinResource,
  deleteBuiltinResource,
} from '@/services/builtinResourceService';

export const useBuiltinResourceData = () => {
  const { t } = useTranslation();
  const [resources, setResources] = useState<BuiltinResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBuiltinResources();
      setResources(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching built-in resources:', err);
      setError(err instanceof Error ? err.message : t('builtinResources.fetchError'));
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const addResource = async (resource: Omit<BuiltinResource, 'id'>) => {
    try {
      const result = await createBuiltinResource(resource);
      triggerRefresh();
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : t('builtinResources.createError');
      setError(message);
      return { success: false, message };
    }
  };

  const editResource = async (id: string, resource: Partial<BuiltinResource>) => {
    try {
      const result = await updateBuiltinResource(id, resource);
      triggerRefresh();
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : t('builtinResources.updateError');
      setError(message);
      return { success: false, message };
    }
  };

  const removeResource = async (id: string) => {
    try {
      await deleteBuiltinResource(id);
      triggerRefresh();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : t('builtinResources.deleteError');
      setError(message);
      return { success: false, message };
    }
  };

  useEffect(() => {
    fetchResources();
  }, [fetchResources, refreshKey]);

  return {
    resources,
    loading,
    error,
    setError,
    triggerRefresh,
    addResource,
    editResource,
    removeResource,
  };
};

```

### Core Architecture Module: `frontend/src/hooks/useCloudData.ts`
```
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudServer, ApiResponse, CloudServerTool } from '@/types';
import { apiGet, apiPost } from '../utils/fetchInterceptor';

export const useCloudData = () => {
  const { t } = useTranslation();
  const [servers, setServers] = useState<CloudServer[]>([]);
  const [allServers, setAllServers] = useState<CloudServer[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentServer, setCurrentServer] = useState<CloudServer | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [serversPerPage, setServersPerPage] = useState(9);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch all cloud market servers
  const fetchCloudServers = useCallback(async () => {
    try {
      setLoading(true);
      const data: ApiResponse<CloudServer[]> = await apiGet('/cloud/servers');

      if (data && data.success && Array.isArray(data.data)) {
        setAllServers(data.data);
        // Apply pagination to the fetched data
        applyPagination(data.data, currentPage);
      } else {
        console.error('Invalid cloud market servers data format', { data });
        setError(t('cloud.fetchError'));
      }
    } catch (err) {
      console.error('Error fetching cloud market servers', { err });
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Keep the original error message for API key errors
      if (
        errorMessage === 'MCPROUTER_API_KEY_NOT_CONFIGURED' ||
        errorMessage.toLowerCase().includes('mcprouter api key not configured')
      ) {
        setError(errorMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Apply pagination to data
  const applyPagination = useCallback(
    (data: CloudServer[], page: number, itemsPerPage = serversPerPage) => {
      const totalItems = data.length;
      const calculatedTotalPages = Math.ceil(totalItems / itemsPerPage);
      setTotalPages(calculatedTotalPages);

      // Ensure current page is valid
      const validPage = Math.max(1, Math.min(page, calculatedTotalPages));
      if (validPage !== page) {
        setCurrentPage(validPage);
      }

      const startIndex = (validPage - 1) * itemsPerPage;
      const paginatedServers = data.slice(startIndex, startIndex + itemsPerPage);
      setServers(paginatedServers);
    },
    [serversPerPage],
  );

  // Change page
  const changePage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      applyPagination(allServers, page, serversPerPage);
    },
    [allServers, applyPagination, serversPerPage],
  );

  // Fetch all categories
  const fetchCategories = useCallback(async () => {
    try {
      const data: ApiResponse<string[]> = await apiGet('/cloud/categories');

      if (data && data.success && Array.isArray(data.data)) {
        setCategories(data.data);
      } else {
        console.error('Invalid cloud market categories data format', { data });
      }
    } catch (err) {
      console.error('Error fetching cloud market categories', { err });
    }
  }, []);

  // Fetch all tags
  const fetchTags = useCallback(async () => {
    try {
      const data: ApiResponse<string[]> = await apiGet('/cloud/tags');

      if (data && data.success && Array.isArray(data.data)) {
        setTags(data.data);
      } else {
        console.error('Invalid cloud market tags data format', { data });
      }
    } catch (err) {
      console.error('Error fetching cloud market tags', { err });
    }
  }, []);

  // Fetch server by name
  const fetchServerByName = useCallback(
    async (name: string) => {
      try {
        setLoading(true);
        const data: ApiResponse<CloudServer> = await apiGet(`/cloud/servers/${name}`);

        if (data && data.success && data.data) {
          setCurrentServer(data.data);
          return data.data;
        } else {
          console.error('Invalid cloud server data format', { name, data });
          setError(t('cloud.serverNotFound'));
          return null;
        }
      } catch (err) {
        console.error('Error fetching cloud server', { name, err });
        const errorMessage = err instanceof Error ? err.message : String(err);
        // Keep the original error message for API key errors
        if (
          errorMessage === 'MCPROUTER_API_KEY_NOT_CONFIGURED' ||
          errorMessage.toLowerCase().includes('mcprouter api key not configured')
        ) {
          setError(errorMessage);
        } else {
          setError(errorMessage);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Search servers by query
  const searchServers = useCallback(
    async (query: string) => {
      try {
        setLoading(true);
        setSearchQuery(query);

        if (!query.trim()) {
          // Fetch fresh data from server instead of just applying pagination
          fetchCloudServers();
          return;
        }

        const data: ApiResponse<CloudServer[]> = await apiGet(
          `/cloud/servers/search?query=${encodeURIComponent(query)}`,
        );

        if (data && data.success && Array.isArray(data.data)) {
          setAllServers(data.data);
          setCurrentPage(1);
          applyPagination(data.data, 1);
        } else {
          console.error('Invalid cloud search results format', { query, data });
          setError(t('cloud.searchError'));
        }
      } catch (err) {
        console.error('Error searching cloud servers', { query, err });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [t, allServers, applyPagination, fetchCloudServers],
  );

  // Filter servers by category
  const filterByCategory = useCallback(
    async (category: string) => {
      try {
        setLoading(true);
        setSelectedCategory(category);
        setSelectedTag(''); // Reset tag filter when filtering by category

        if (!category) {
          fetchCloudServers();
          return;
        }

        const data: ApiResponse<CloudServer[]> = await apiGet(
          `/cloud/categories/${encodeURIComponent(category)}`,
        );

        if (data && data.success && Array.isArray(data.data)) {
          setAllServers(data.data);
          setCurrentPage(1);
          applyPagination(data.data, 1);
        } else {
          console.error('Invalid cloud category filter results format', { category, data });
          setError(t('cloud.filterError'));
        }
      } catch (err) {
        console.error('Error filtering cloud servers by category', { category, err });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [t, fetchCloudServers, applyPagination],
  );

  // Filter servers by tag
  const filterByTag = useCallback(
    async (tag: string) => {
      try {
        setLoading(true);
        setSelectedTag(tag);
        setSelectedCategory(''); // Reset category filter when filtering by tag

        if (!tag) {
          fetchCloudServers();
          return;
        }

        const data: ApiResponse<CloudServer[]> = await apiGet(
          `/cloud/tags/${encodeURIComponent(tag)}`,
        );

        if (data && data.success && Array.isArray(data.data)) {
          setAllServers(data.data);
          setCurrentPage(1);
          applyPagination(data.data, 1);
        } else {
          console.error('Invalid cloud tag filter results format', { tag, data });
          setError(t('cloud.tagFilterError'));
        }
      } catch (err) {
        console.error('Error filtering cloud servers by tag', { tag, err });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [t, fetchCloudServers, applyPagination],
  );

  // Fetch tools for a specific server
  const fetchServerTools = useCallback(async (serverName: string) => {
    try {
      const data: ApiResponse<CloudServerTool[]> = await apiGet(
        `/cloud/servers/${serverName}/tools`,
      );

      if (!data.success) {
        console.error('Failed to fetch cloud server tools', { serverName, data });
        throw new Error(data.message || 'Failed to fetch cloud server tools');
      }

      if (data && data.success && Array.isArray(data.data)) {
        return data.data;
      } else {
        console.error('Invalid cloud server tools data format', { serverName, data });
        return [];
      }
    } catch (err) {
      console.error('Error fetching tools for cloud server', { serverName, err });
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Re-throw API key errors so they can be handled by the component
      if (
        errorMessage === 'MCPROUTER_API_KEY_NOT_CONFIGURED' ||
        errorMessage.toLowerCase().includes('mcprouter api key not configured')
      ) {
        throw err;
      }
      return [];
    }
  }, []);

  // Call a tool on a cloud server
  const callServerTool = useCallback(
    async (serverName: string, toolName: string, args: Record<string, any>) => {
      try {
        // URL-encode server and tool names to handle slashes (e.g., "com.atlassian/atlassian-mcp-server")
        const data = await apiPost(
          `/cloud/servers/${encodeURIComponent(serverName)}/tools/${encodeURIComponent(toolName)}/call`,
          {
            arguments: args,
          },
        );

        if
```

### Core Architecture Module: `frontend/src/hooks/useCostData.ts`
```
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '../utils/fetchInterceptor';
import type { ApiResponse, ServerCost, GroupCost } from '@/types';

export const useCostData = () => {
  const [serverCosts, setServerCosts] = useState<ServerCost[]>([]);
  const [groupCosts, setGroupCosts] = useState<GroupCost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCosts = useCallback(async () => {
    try {
      setLoading(true);
      const [servers, groups] = await Promise.all([
        apiGet('/cost/servers') as Promise<ApiResponse<ServerCost[]>>,
        apiGet('/cost/groups') as Promise<ApiResponse<GroupCost[]>>,
      ]);
      if (servers?.success && Array.isArray(servers.data)) setServerCosts(servers.data);
      if (groups?.success && Array.isArray(groups.data)) setGroupCosts(groups.data);
    } catch (err) {
      console.error('Error fetching context footprint:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  return { serverCosts, groupCosts, loading, refetch: fetchCosts };
};

```

### Core Architecture Module: `frontend/src/hooks/useGroupData.ts`
```
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Group, ApiResponse, IGroupServerConfig } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/fetchInterceptor';

export const useGroupData = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data: ApiResponse<Group[]> = await apiGet('/groups');

      if (data && data.success && Array.isArray(data.data)) {
        setGroups(data.data);
      } else {
        console.error('Invalid group data format:', data);
        setGroups([]);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger a refresh of the groups data
  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Create a new group with server associations
  const createGroup = async (
    name: string,
    description?: string,
    servers: string[] | IGroupServerConfig[] = [],
    access: Pick<Group, 'visibility' | 'sharedWithUsers'> = {},
  ) => {
    try {
      const result: ApiResponse<Group> = await apiPost('/groups', {
        name,
        description,
        servers,
        ...access,
      });
      console.log('Group created successfully:', result);

      if (!result || !result.success) {
        setError(result?.message || t('groups.createError'));
        return result;
      }

      triggerRefresh();
      return result || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
      return null;
    }
  };

  // Update an existing group with server associations
  const updateGroup = async (
    id: string,
    data: Partial<
      Pick<Group, 'name' | 'description' | 'servers' | 'visibility' | 'sharedWithUsers'>
    >,
  ) => {
    try {
      const result: ApiResponse<Group> = await apiPut(`/groups/${id}`, data);
      if (!result || !result.success) {
        setError(result?.message || t('groups.updateError'));
        return result;
      }

      triggerRefresh();
      return result || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group');
      return null;
    }
  };

  // Update servers in a group (for batch updates)
  const updateGroupServers = async (groupId: string, servers: string[] | IGroupServerConfig[]) => {
    try {
      const result: ApiResponse<Group> = await apiPut(`/groups/${groupId}/servers/batch`, {
        servers,
      });

      if (!result || !result.success) {
        setError(result?.message || t('groups.updateError'));
        return null;
      }

      triggerRefresh();
      return result.data || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group servers');
      return null;
    }
  };

  // Delete a group
  const deleteGroup = async (id: string) => {
    try {
      const result = await apiDelete(`/groups/${id}`);
      if (!result || !result.success) {
        setError(result?.message || t('groups.deleteError'));
        return result;
      }

      triggerRefresh();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
      return null;
    }
  };

  // Add server to a group
  const addServerToGroup = async (groupId: string, serverName: string) => {
    try {
      const result: ApiResponse<Group> = await apiPost(`/groups/${groupId}/servers`, {
        serverName,
      });

      if (!result || !result.success) {
        setError(result?.message || t('groups.serverAddError'));
        return null;
      }

      triggerRefresh();
      return result.data || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add server to group');
      return null;
    }
  };

  // Remove server from group
  const removeServerFromGroup = async (groupId: string, serverName: string) => {
    try {
      const result: ApiResponse<Group> = await apiDelete(
        `/groups/${groupId}/servers/${serverName}`,
      );

      if (!result || !result.success) {
        setError(result?.message || t('groups.serverRemoveError'));
        return null;
      }

      triggerRefresh();
      return result.data || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove server from group');
      return null;
    }
  };

  // Fetch groups when the component mounts or refreshKey changes
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups, refreshKey]);

  return {
    groups,
    loading,
    error,
    setError,
    triggerRefresh,
    createGroup,
    updateGroup,
    updateGroupServers,
    deleteGroup,
    addServerToGroup,
    removeServerFromGroup,
  };
};

```

### Core Architecture Module: `frontend/src/hooks/useMarketData.ts`
```
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MarketServer, ApiResponse, ServerConfig } from '@/types';
import { apiGet, apiPost } from '../utils/fetchInterceptor';

export const useMarketData = () => {
  const { t } = useTranslation();
  const [servers, setServers] = useState<MarketServer[]>([]);
  const [allServers, setAllServers] = useState<MarketServer[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentServer, setCurrentServer] = useState<MarketServer | null>(null);
  const [installedServers, setInstalledServers] = useState<string[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [serversPerPage, setServersPerPage] = useState(9);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch all market servers
  const fetchMarketServers = useCallback(async () => {
    try {
      setLoading(true);
      const data: ApiResponse<MarketServer[]> = await apiGet('/market/servers');

      if (data && data.success && Array.isArray(data.data)) {
        setAllServers(data.data);
        // Apply pagination to the fetched data
        applyPagination(data.data, currentPage);
      } else {
        console.error('Invalid market servers data format', { data });
        setError(t('market.fetchError'));
      }
    } catch (err) {
      console.error('Error fetching market servers', { err });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Apply pagination to data
  const applyPagination = useCallback(
    (data: MarketServer[], page: number, itemsPerPage = serversPerPage) => {
      const totalItems = data.length;
      const calculatedTotalPages = Math.ceil(totalItems / itemsPerPage);
      setTotalPages(calculatedTotalPages);

      // Ensure current page is valid
      const validPage = Math.max(1, Math.min(page, calculatedTotalPages));
      if (validPage !== page) {
        setCurrentPage(validPage);
      }

      const startIndex = (validPage - 1) * itemsPerPage;
      const paginatedServers = data.slice(startIndex, startIndex + itemsPerPage);
      setServers(paginatedServers);
    },
    [serversPerPage],
  );

  // Change page
  const changePage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      applyPagination(allServers, page, serversPerPage);
    },
    [allServers, applyPagination, serversPerPage],
  );

  // Fetch all categories
  const fetchCategories = useCallback(async () => {
    try {
      const data: ApiResponse<string[]> = await apiGet('/market/categories');

      if (data && data.success && Array.isArray(data.data)) {
        setCategories(data.data);
      } else {
        console.error('Invalid categories data format', { data });
      }
    } catch (err) {
      console.error('Error fetching categories', { err });
    }
  }, []);

  // Fetch all tags
  const fetchTags = useCallback(async () => {
    try {
      const data: ApiResponse<string[]> = await apiGet('/market/tags');

      if (data && data.success && Array.isArray(data.data)) {
        setTags(data.data);
      } else {
        console.error('Invalid tags data format', { data });
      }
    } catch (err) {
      console.error('Error fetching tags', { err });
    }
  }, []);

  // Fetch server by name
  const fetchServerByName = useCallback(
    async (name: string) => {
      try {
        setLoading(true);
        const data: ApiResponse<MarketServer> = await apiGet(`/market/servers/${name}`);

        if (data && data.success && data.data) {
          setCurrentServer(data.data);
          return data.data;
        } else {
          console.error('Invalid market server data format', { name, data });
          setError(t('market.serverNotFound'));
          return null;
        }
      } catch (err) {
        console.error('Error fetching market server', { name, err });
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Search servers by query
  const searchServers = useCallback(
    async (query: string) => {
      try {
        setLoading(true);
        setSearchQuery(query);

        if (!query.trim()) {
          // Fetch fresh data from server instead of just applying pagination
          fetchMarketServers();
          return;
        }

        const data: ApiResponse<MarketServer[]> = await apiGet(
          `/market/servers/search?query=${encodeURIComponent(query)}`,
        );

        if (data && data.success && Array.isArray(data.data)) {
          setAllServers(data.data);
          setCurrentPage(1);
          applyPagination(data.data, 1);
        } else {
          console.error('Invalid market search results format', { query, data });
          setError(t('market.searchError'));
        }
      } catch (err) {
        console.error('Error searching market servers', { query, err });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [t, allServers, applyPagination, fetchMarketServers],
  );

  // Filter servers by category
  const filterByCategory = useCallback(
    async (category: string) => {
      try {
        setLoading(true);
        setSelectedCategory(category);
        setSelectedTag(''); // Reset tag filter when filtering by category

        if (!category) {
          fetchMarketServers();
          return;
        }

        const data: ApiResponse<MarketServer[]> = await apiGet(
          `/market/categories/${encodeURIComponent(category)}`,
        );

        if (data && data.success && Array.isArray(data.data)) {
          setAllServers(data.data);
          setCurrentPage(1);
          applyPagination(data.data, 1);
        } else {
          console.error('Invalid market category filter results format', { category, data });
          setError(t('market.filterError'));
        }
      } catch (err) {
        console.error('Error filtering market servers by category', { category, err });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [t, fetchMarketServers, applyPagination],
  );

  // Filter servers by tag
  const filterByTag = useCallback(
    async (tag: string) => {
      try {
        setLoading(true);
        setSelectedTag(tag);
        setSelectedCategory(''); // Reset category filter when filtering by tag

        if (!tag) {
          fetchMarketServers();
          return;
        }

        const data: ApiResponse<MarketServer[]> = await apiGet(
          `/market/tags/${encodeURIComponent(tag)}`,
        );

        if (data && data.success && Array.isArray(data.data)) {
          setAllServers(data.data);
          setCurrentPage(1);
          applyPagination(data.data, 1);
        } else {
          console.error('Invalid market tag filter results format', { tag, data });
          setError(t('market.tagFilterError'));
        }
      } catch (err) {
        console.error('Error filtering market servers by tag', { tag, err });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [t, fetchMarketServers, applyPagination],
  );

  // Fetch installed servers
  const fetchInstalledServers = useCallback(async () => {
    try {
      const data = await apiGet<{ success: boolean; data: any[] }>('/servers');

      if (data && data.success && Array.isArray(data.data)) {
        // Extract server names
        const installedServerNames = data.data.map((server: any) => server.name);
        setInstalledServers(installedServerNames);
      }
    } catch (err) {
      console.error('Error fetching installed servers', { err });
    }
  }, []);

  // Check if a server is already installed
  const isServerInstalled = useCallback(
    (serverName: string) => {
      return installedServers.includes(serverName);
    },
    [installedServers],
  );

  // Install server to the local environment
  const installServer = useCallback(
    async (server: MarketServer, customConfig: ServerConfig) => {
      try {
        const installType = server.installations?.npm
          ? 'npm'
          : Object.keys(server.installations || {}).length > 0
            ? Object.keys(server.installations)[0]
            : null;

        if (!installType || !server.installations?.[installType]) {
          setError(t('market.noInstallationMethod'));
          return false;
        }

        const installation = server.installations[installType];

        // Prepare server configuration, merging with customConfig
        const serverConfig = {
          name: server.name,
          config:
            customConfig.type === 'stdio'
              ? {
                  command: customConfig.command || installation.command || '',
                  args: customConfig.args || installation.args || [],
                  env: { ...installation.env, ...customConfig.env },
                }
              : customConfig,
        };

        // Call the createServer API
        const result = await apiPost<{ success: boolean; message?: string }>(
          '/servers',
          serverConfig,
        );

        if (!result.success) {
          throw new Error(result.message || 'Failed to install server');
        }

        // Update installed servers list after successful installation
        await fetchInstalledServers();
        return true;
      } catch (err) {
        consol
```

### Core Architecture Module: `frontend/src/hooks/useRegistryData.ts`
```
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RegistryServerEntry,
  RegistryServersResponse,
  RegistryServerVersionResponse,
  RegistryServerVersionsResponse,
} from '@/types';
import { apiGet } from '../utils/fetchInterceptor';

export const useRegistryData = () => {
  const { t } = useTranslation();
  const [servers, setServers] = useState<RegistryServerEntry[]>([]);
  const [allServers, setAllServers] = useState<RegistryServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cursor-based pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [serversPerPage, setServersPerPage] = useState(9);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [totalPages] = useState(1); // Legacy support, not used in cursor pagination

  // Fetch registry servers with cursor-based pagination
  const fetchRegistryServers = useCallback(
    async (cursor?: string, search?: string) => {
      try {
        setLoading(true);
        setError(null);

        // Build query parameters
        const params = new URLSearchParams();
        params.append('limit', serversPerPage.toString());
        if (cursor) {
          params.append('cursor', cursor);
        }
        const queryToUse = search !== undefined ? search : searchQuery;
        if (queryToUse.trim()) {
          params.append('search', queryToUse.trim());
        }

        const response = await apiGet(`/registry/servers?${params.toString()}`);

        if (response && response.success && response.data) {
          const data: RegistryServersResponse = response.data;
          if (data.servers && Array.isArray(data.servers)) {
            setServers(data.servers);
            // Update pagination state
            const hasMore = data.metadata.count === serversPerPage && !!data.metadata.nextCursor;
            setHasNextPage(hasMore);
            setNextCursor(data.metadata.nextCursor || null);

            // For display purposes, keep track of all loaded servers
            if (!cursor) {
              // First page
              setAllServers(data.servers);
            } else {
              // Subsequent pages - append to all servers
              setAllServers((prev) => [...prev, ...data.servers]);
            }
          } else {
            console.error('Invalid registry servers data format', { data });
            setError(t('registry.fetchError'));
          }
        } else {
          setError(t('registry.fetchError'));
        }
      } catch (err) {
          console.error('Error fetching registry servers', { cursor, search, err });
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [t, serversPerPage],
  );

  // Navigate to next page
  const goToNextPage = useCallback(async () => {
    if (!hasNextPage || !nextCursor) return;

    // Save current cursor to history for back navigation
    const currentCursor = cursorHistory[cursorHistory.length - 1] || '';
    setCursorHistory((prev) => [...prev, currentCursor]);

    setCurrentPage((prev) => prev + 1);
    await fetchRegistryServers(nextCursor, searchQuery);
  }, [hasNextPage, nextCursor, cursorHistory, searchQuery, fetchRegistryServers]);

  // Navigate to previous page
  const goToPreviousPage = useCallback(async () => {
    if (currentPage <= 1) return;

    // Get the previous cursor from history
    const newHistory = [...cursorHistory];
    newHistory.pop(); // Remove current position
    const previousCursor = newHistory[newHistory.length - 1];

    setCursorHistory(newHistory);
    setCurrentPage((prev) => prev - 1);

    // Fetch with previous cursor (undefined for first page)
    await fetchRegistryServers(previousCursor || undefined, searchQuery);
  }, [currentPage, cursorHistory, searchQuery, fetchRegistryServers]);

  // Change page (legacy support for page number navigation)
  const changePage = useCallback(
    async (page: number) => {
      if (page === currentPage) return;

      if (page > currentPage && hasNextPage) {
        await goToNextPage();
      } else if (page < currentPage && currentPage > 1) {
        await goToPreviousPage();
      }
    },
    [currentPage, hasNextPage, goToNextPage, goToPreviousPage],
  );

  // Change items per page
  const changeServersPerPage = useCallback(
    async (newServersPerPage: number) => {
      setServersPerPage(newServersPerPage);
      setCurrentPage(1);
      setCursorHistory([]);
      setAllServers([]);
      await fetchRegistryServers(undefined, searchQuery);
    },
    [searchQuery, fetchRegistryServers],
  );

  // Fetch server by name
  const fetchServerByName = useCallback(
    async (serverName: string) => {
      try {
        setLoading(true);
        setError(null);

        // URL encode the server name
        const encodedName = encodeURIComponent(serverName);
        const response = await apiGet(`/registry/servers/versions?serverName=${encodedName}`);

        if (response && response.success && response.data) {
          const data: RegistryServerVersionsResponse = response.data;
          if (data.servers && Array.isArray(data.servers) && data.servers.length > 0) {
            // Return the first server entry (should be the latest or specified version)
            return data.servers[0];
          } else {
            console.error('Invalid registry server data format', { serverName, data });
            setError(t('registry.serverNotFound'));
            return null;
          }
        } else {
          setError(t('registry.serverNotFound'));
          return null;
        }
      } catch (err) {
        console.error('Error fetching registry server', { serverName, err });
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Fetch all versions of a server
  const fetchServerVersions = useCallback(async (serverName: string) => {
    try {
      setError(null);

      // URL encode the server name
      const encodedName = encodeURIComponent(serverName);
      const response = await apiGet(`/registry/servers/versions?serverName=${encodedName}`);

      if (response && response.success && response.data) {
        const data: RegistryServerVersionsResponse = response.data;
        if (data.servers && Array.isArray(data.servers)) {
          return data.servers;
        } else {
          console.error('Invalid registry server versions data format', { serverName, data });
          return [];
        }
      } else {
        return [];
      }
    } catch (err) {
      console.error('Error fetching versions for registry server', { serverName, err });
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return [];
    }
  }, []);

  // Fetch specific version of a server
  const fetchServerVersion = useCallback(async (serverName: string, version: string) => {
    try {
      setError(null);

      // URL encode the server name and version
      const encodedName = encodeURIComponent(serverName);
      const encodedVersion = encodeURIComponent(version);
      const response = await apiGet(`/registry/servers/version?serverName=${encodedName}&version=${encodedVersion}`);

      if (response && response.success && response.data) {
        const data: RegistryServerVersionResponse = response.data;
        if (data && data.server) {
          return data;
        } else {
          console.error('Invalid registry server version data format', { serverName, version, data });
          return null;
        }
      } else {
        return null;
      }
    } catch (err) {
      console.error('Error fetching specific registry server version', { serverName, version, err });
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return null;
    }
  }, []);

  // Search servers by query (client-side filtering on loaded data)
  const searchServers = useCallback(
    async (query: string) => {
      console.log('Searching registry servers', { query });
      setSearchQuery(query);
      setCurrentPage(1);
      setCursorHistory([]);
      setAllServers([]);

      await fetchRegistryServers(undefined, query);
    },
    [fetchRegistryServers],
  );

  // Clear search
  const clearSearch = useCallback(async () => {
    setSearchQuery('');
    setCurrentPage(1);
    setCursorHistory([]);
    setAllServers([]);
    await fetchRegistryServers(undefined, '');
  }, [fetchRegistryServers]);

  // Initial fetch
  useEffect(() => {
    fetchRegistryServers(undefined, searchQuery);
    // Only run on mount
  }, []);

  return {
    servers,
    allServers,
    loading,
    error,
    setError,
    searchQuery,
    searchServers,
    clearSearch,
    fetchServerByName,
    fetchServerVersions,
    fetchServerVersion,
    // Cursor-based pagination
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage: currentPage > 1,
    changePage,
    goToNextPage,
    goToPreviousPage,
    serversPerPage,
    changeServersPerPage,
  };
};

```

### Core Architecture Module: `frontend/src/hooks/useServerData.ts`
```
// This hook now delegates to the ServerContext to avoid duplicate requests
// All components will share the same server data and polling mechanism
import { useServerContext } from '@/contexts/ServerContext';
import { useEffect } from 'react';

export const useServerData = (options?: { refreshOnMount?: boolean }) => {
  const context = useServerContext();
  const { refreshIfNeeded } = context;

  // Optionally refresh on mount for pages that need fresh data
  useEffect(() => {
    if (options?.refreshOnMount) {
      refreshIfNeeded();
    }
  }, [options?.refreshOnMount, refreshIfNeeded]);

  return context;
};


```

### Core Architecture Module: `frontend/src/hooks/useSettingsData.ts`
```
import { useSettings } from '@/contexts/SettingsContext';

/**
 * Hook that provides access to settings data via SettingsContext.
 * This hook is a thin wrapper around useSettings to maintain backward compatibility.
 * The actual data fetching happens once in SettingsProvider, avoiding duplicate API calls.
 */
export const useSettingsData = () => {
  return useSettings();
};

```

### Core Architecture Module: `frontend/src/hooks/useUserData.ts`
```
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { User, ApiResponse, UserFormData, UserUpdateData } from '@/types';
import { apiDelete, apiGet, apiPost, apiPut } from '../utils/fetchInterceptor';

export const useUserData = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data: ApiResponse<User[]> = await apiGet('/users');
      if (!data.success) {
        setError(data.message || t('users.fetchError'));
        return;
      }

      if (data && data.success && Array.isArray(data.data)) {
        setUsers(data.data);
      } else {
        console.error('Invalid user data format:', data);
        setUsers([]);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger a refresh of the users data
  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Create a new user
  const createUser = async (userData: UserFormData) => {
    try {
      const result: ApiResponse<User> = await apiPost('/users', userData);
      triggerRefresh();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      return null;
    }
  };

  // Update an existing user
  const updateUser = async (username: string, data: UserUpdateData) => {
    try {
      const result: ApiResponse<User> = await apiPut(`/users/${username}`, data);
      triggerRefresh();
      return result || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      return null;
    }
  };

  // Delete a user
  const deleteUser = async (username: string) => {
    try {
      const result = await apiDelete(`/users/${username}`);
      if (!result?.success) {
        setError(result?.message || t('users.deleteError'));
        return result;
      }

      triggerRefresh();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      return false;
    }
  };

  // Fetch users when the component mounts or refreshKey changes
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  return {
    users,
    loading,
    error,
    setError,
    triggerRefresh,
    createUser,
    updateUser,
    deleteUser,
  };
};

```

### Core Architecture Module: `frontend/src/utils/api.ts`
```
/**
 * API utility functions for constructing URLs with proper base path support
 *
 * @deprecated Use functions from utils/runtime.ts instead for runtime configuration support
 */

import { getApiBaseUrl as getRuntimeApiBaseUrl, getApiUrl as getRuntimeApiUrl } from './runtime';

/**
 * Get the API base URL including base path and /api prefix
 * @returns The complete API base URL
 * @deprecated Use getApiBaseUrl from utils/runtime.ts instead
 */
export const getApiBaseUrl = (): string => {
  console.warn('getApiBaseUrl from utils/api.ts is deprecated, use utils/runtime.ts instead');
  return getRuntimeApiBaseUrl();
};

/**
 * Construct a full API URL with the given endpoint
 * @param endpoint - The API endpoint (should start with /, e.g., '/auth/login')
 * @returns The complete API URL
 * @deprecated Use getApiUrl from utils/runtime.ts instead
 */
export const getApiUrl = (endpoint: string): string => {
  console.warn('getApiUrl from utils/api.ts is deprecated, use utils/runtime.ts instead');
  return getRuntimeApiUrl(endpoint);
};

```

### Core Architecture Module: `frontend/src/utils/bearerKeyScopeFilter.ts`
```
import type { BearerKey, User } from '@/types';

type ScopeFilterTranslator = (key: string, options?: { defaultValue?: string }) => string;

export type BearerKeyScopeFilterValue = 'all' | 'system' | `user:${string}`;

type BearerKeyScopeFilterOption = {
  value: BearerKeyScopeFilterValue;
  label: string;
};

const getBearerKeyKind = (key: BearerKey): 'system' | 'user' => (key.kind === 'user' ? 'user' : 'system');

const getUserScopedOwners = (bearerKeys: BearerKey[], users: User[]): string[] => {
  const knownUsers = new Set(users.map((user) => user.username));
  const owners = Array.from(new Set(
    bearerKeys
      .filter((key) => getBearerKeyKind(key) === 'user' && typeof key.owner === 'string' && key.owner.trim().length > 0)
      .map((key) => key.owner!.trim()),
  ));

  owners.sort((left, right) => {
    const leftKnown = knownUsers.has(left);
    const rightKnown = knownUsers.has(right);
    if (leftKnown !== rightKnown) {
      return leftKnown ? -1 : 1;
    }
    return left.localeCompare(right);
  });

  return owners;
};

export const getBearerKeyScopeFilterOptions = (
  t: ScopeFilterTranslator,
  bearerKeys: BearerKey[],
  users: User[] = [],
): BearerKeyScopeFilterOption[] => {
  const options: BearerKeyScopeFilterOption[] = [
    {
      value: 'all',
      label: t('settings.bearerKeyAccessAll', { defaultValue: 'All' }),
    },
  ];

  if (bearerKeys.some((key) => getBearerKeyKind(key) === 'system')) {
    options.push({
      value: 'system',
      label: t('settings.bearerKeyKindSystem', { defaultValue: 'System-level' }),
    });
  }

  const userLabel = t('settings.bearerKeyKindUser', { defaultValue: 'User-level' });
  for (const owner of getUserScopedOwners(bearerKeys, users)) {
    options.push({
      value: `user:${owner}`,
      label: `${userLabel} · ${owner}`,
    });
  }

  return options;
};

export const filterBearerKeysByScopeFilter = (
  bearerKeys: BearerKey[],
  scopeFilter: BearerKeyScopeFilterValue,
): BearerKey[] => {
  if (scopeFilter === 'all') {
    return bearerKeys;
  }

  if (scopeFilter === 'system') {
    return bearerKeys.filter((key) => getBearerKeyKind(key) === 'system');
  }

  const owner = scopeFilter.slice('user:'.length);
  return bearerKeys.filter((key) => getBearerKeyKind(key) === 'user' && key.owner === owner);
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1283** (2026-10-06): **Suggestion: configurable maxBufferSize for stdio servers (responses over 10 MB disconnect since v1.0.42)**
  *Symptoms*: ## Summary  Since v1.0.42, a stdio server whose tool response is larger than 10 MB gets its process killed by MCPHub. Every later call to that server then fails with `Not connected` until someone reconnects it manually. The log only shows `Connection closed`, so the real cause is hard to find.  The limit comes from the default `maxBufferSize` (10 MB) of `StdioClientTransport` in `@modelcontextprotocol/client` 2.x. That option is public, but MCPHub doesn't pass it, so users have no way to raise it.  ## Versions  - Affected: v1.0.42 and later. Reproduced on v1.1.0. The same 10 MB constant is present in the v1.0.43 and v1.0.44 images; we didn't run the reproduction there. - Not affected: v1.0.41 and earlier (`@modelcontextprotocol/sdk` 1.29.0). On v1.0.37 and v1.0.40 a 117 MB response goes through. - Introduced by 8d9f9a7 "refactor: migrate to MCP SDK v2 with legacy protocol compatibility (#1224)". - Latest `main` (01f4bb8, 2026-10-04) still doesn't pass `maxBufferSize` (`src/services/mcpService.ts`, `new StdioClientTransport({...})`).  ## Reproduction  `big_stdio.py` is a minimal stdio server. It returns one text block of `mb` megabytes:  ```python import json, sys  for line in sys.stdin:     req = json.loads(line)     if "id" not in req:         continue     method = req["method"]     if method == "initialize":         result = {"protocolVersion": req["params"].get("protocolVersion", "2025-06-18"),                   "capabilities": {"tools": {}}, "serverInfo": {"name": "big-st
  **Post-Mortem & Fix Analysis**:
  > Some follow-up measurements on the "Related" part (the hub slowing down while it reads a large stdio response). I hope they help.  ## Where the time goes  Same tool and payload as above: 50,000 rows, 117.5 MB in a single `tools/call` response. MCPHub v1.0.40 (`@modelcontextprotocol/sdk` 1.29.0), stdio server.  | Step | Fast host | Slower host (VM) | |---|---|---| | Server alone: build and write the full response to stdout (piped to `wc -c`) | 6.7 s | 32.6 s | | End to end through MCPHub (`tools/call` on `/mcp`) | ~77–86 s | > 600 s (hit the request timeout) |  So the server side takes only a small share of the time (under 6% on the slower host). Almost all of it is spent in MCPHub while it reads the response.  Through MCPHub, the time grows much faster than the size (slower host, `DEFAULT_REQUEST_TIMEOUT=600000`):  | Rows | Size | Time | |---|---|---| | 10,000 | 23.3 MB | 18.3 s | | 20,000 | 46.9 MB | 92.9 s | | 30,000 | 70.4 MB | 274 s | | 50,000 | 117.5 MB | timed out after 600 s |  
  > Follow-up: I filed the `ReadBuffer` part upstream as modelcontextprotocol/typescript-sdk#2961, with an SDK-only reproduction.  Quick summary of the measurements there. Same machine, the 117.5 MB response above, timed from spawning the server to having the parsed message:  | Reader | Time | |---|---| | SDK 1.29.0 `ReadBuffer` | 71.4 s | | Search only each new chunk for `\n`, concatenate once | 3.4 s | | The server alone | ~3.5 s |  So almost all the time goes into `ReadBuffer`, not into the server.  Until the SDK changes this, one option on the MCPHub side would be a small custom stdio `Transport`. `Client.connect()` accepts any `Transport`, so it would only use the public interface. It could buffer incoming chunks this way, which would avoid both the slowdown and the event-loop blocking for large stdio responses. Just a suggestion; I understand if you'd rather wait for the SDK fix. 
  > <!-- github-maintainer:status --> Confirmed the SDK default-limit regression and delivered the finite per-server configuration repair in #1284 (`a9df3299354af8fabb478df7760a882d96681bc3`). Set `options.maxBufferSize` to a positive safe integer in bytes; leaving it unset retains the existing 10 MiB limit. The setting survives dashboard/configuration normalization, and invalid values are rejected.  A real-process regression verifies an 11 MiB response with a 16 MiB limit, followed by another successful call. Independent review found no blocking issues; current Node 20/22 CI and CodeQL checks pass. Full local suite/build/lint/docs checks pass. UI save/reopen and live PostgreSQL round-trip were not exercised.  Next owner: maintainer, for PR review and merge approval. This issue stays open: unlimited values, an environment default, and the SDK large-response performance concern are separate follow-up decisions. The finite configurable limit can land independently; no merge or issue closure 

- **Issue #1264** (2026-10-02): **Contrast Issue on Token Dialogue during darkmode**
  *Symptoms*: **Bug Description / 问题描述** The "copy this token now" box that shows up right after creating a bearer key is basically unreadable in dark mode — it's pale yellow text on a pale yellow background, so there's almost zero contrast. The token's actually in there, you just can't see it unless you select the text or squint really hard.  **Steps to Reproduce / 复现步骤** 1. Switch the UI to dark mode 2. Go to Settings → Keys 3. Create a new bearer key 4. Look at the one-time "copy this token now" alert that appears  **Expected Behavior / 预期行为** The token alert should be readable in dark mode, same as it is in light mode. Right now it looks like an empty box.  **Environment / 运行环境** - Running on: docker - Version: 1.0.44  **Screenshots / 截图**  **Additional Info / 补充信息** Looks like it's just the alert's classes — `bg-amber-50 border-amber-300` with no `dark:` text color override — so whatever text color applies in dark mode ends up way too close to that light background. Probably a quick fix, just needs a `dark:text-*`/`dark:bg-*` variant on that box.
  **Post-Mortem & Fix Analysis**:
  > I would put in a screen shot but github is refusing right now, sorry

- **Issue #1242** (2026-10-04): **File mode: a server rename can lose the group update because each JSON DAO trusts its own stale settings cache**
  *Symptoms*: **Bug Description / 问题描述**  In file mode (settings in `mcp_settings.json`), renaming a server sometimes leaves its groups pointing at the old name. The server gets the new name, but the group still references the old one. The group then has no member server under that name, so `/mcp/<group>` lists nothing from it, and a later rename finds nothing to update. The API reports success and nothing is logged.  Cause: every JSON DAO instance (`JsonFileBaseDao`, one per entity: servers, groups, bearer keys, …) keeps its own snapshot of `mcp_settings.json`. It treats the snapshot as fresh while `this.lastModified >= stat.mtime`. After its own save it sets `this.lastModified = Date.now()`. The file's mtime, however, comes from the kernel's coarse clock and can lag `Date.now()` by a few milliseconds. A write by *another* DAO a few ms later can therefore get an mtime that is equal to or lower than the first DAO's `lastModified`. The first DAO then keeps serving its stale snapshot, and its next save writes it back, dropping the other DAO's change.  A rename triggers this reliably, because `updateServer` writes through several DAOs back to back: 1. `ServerDao.rename` saves. 2. `GroupDao.updateServerName` saves a few ms later. 3. `addOrUpdateServer` → `ServerDao.update` loads and saves again.  Logged from one failing run, with temporary logging added to `JsonFileBaseDao` (timestamps shortened):      ServerDaoImpl SAVE  ts=…357  mtimeAfter=…352  groups=[["notes"]]     GroupDaoImpl  SAVE  ts=
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed investigation and clear explanation of the root cause! Feel free to work on a fix whenever it is convenient for you. If you do not have time, that is completely fine too—just let us know. No pressure, and thanks again for reporting this.

- **Issue #1241** (2026-09-30): **Smart Routing: credential-template servers are only indexed by a manual reindex, lose their index on rename, and embed their disabled tools**
  *Symptoms*: **Bug Description / 问题描述**  Servers with a `credentialTemplate` (per-user credentials) are searchable through Smart Routing only right after someone calls `POST /api/smart-routing/reindex` (#1199). Otherwise:  - **Never indexed on their own.** A credential server never connects globally: initialization returns early with no tools. The per-user runtime that does get its real tool list (`createPrincipalRuntime`) assigns `info.tools` without going through the embedding sync. So a newly added server, an update that changes its tools, or a wiped index leaves `search_tools` returning nothing for it until an admin runs the reindex. - **A rename empties its index.** `updateServer` drops the old name's embeddings and relies on the reconnect to regenerate them (see the comment there). A credential server never gets that reconnect, so after a rename `search_tools` finds none of its tools until the next manual reindex. The rename also drops the credential bindings. - **The reindex embeds disabled tools.** It embeds the per-principal tool list unmasked. Read-only still holds, because hits are filtered through the tools config afterwards, but the disabled tools use up the search `limit` first. On a server with 170 tools, 97 of them disabled, the query "find photos of a person" returned 6 of 8 relevant hits. - **The reindex ignores tool description overrides**, for every server, not just credential ones. It calls `saveToolsAsVectorEmbeddings` directly and skips the override step that #1200 

- **Issue #1239** (2026-09-30): **Renaming a server re-enables its disabled tools and drops tool and prompt description overrides**
  *Symptoms*: **Bug Description / 问题描述**  Renaming a server silently undoes its per-tool and per-prompt settings made in the dashboard:  - a tool that was disabled is listed again and **can be called**, on every route (direct group, server route, `$smart` `call_tool`); - tool description overrides disappear, so clients see the upstream description again; - disabled prompts are listed again, and prompt description overrides disappear.  Nothing in the UI or the logs shows the change.  Cause: the dashboard stores toggles and overrides under the prefixed item name, e.g. `tools["notes-delete_note"] = { enabled: false }` (see the comment above `findToolOnServer` in `src/services/mcpService.ts`). The rename branch of `updateServer` (`src/controllers/serverController.ts`) moves the server record, its group memberships, bearer keys and embeddings, but copies the `tools` and `prompts` maps unchanged. After `notes` → `notebook` the tool is called `notebook-delete_note`, and `notes-delete_note` no longer matches anything.  **Steps to Reproduce / 复现步骤**  1. Add a stdio server `notes` that has a tool `delete_note` and a prompt, and put the server in a group `g`. 2. In the dashboard, disable `delete_note`, give another tool a custom description, and disable the prompt. 3. Rename the server to `notebook` in its edit form. 4. On `/mcp/g`:    - `tools/list` includes `notebook-delete_note`, and `tools/call` on it succeeds;    - the custom description is gone;    - `prompts/list` shows the disabled prompt aga

- **Issue #1205** (2026-09-24): **Connection terminated due to connection timeout**
  *Symptoms*: **Bug Description / 问题描述** What happened? / 发生了什么？ 你好我是用的MCP HUB 1.0.37在高并发情况下,数据库执行:SELECT state, count(*) FROM pg_stat_activity GROUP BY state;出现idle in transaction =1,后服务就hold住一直在重试连接,HCP HUB报错: [2026-09-22T14:32:35.195+08:00] [ERROR] [1] [main] Unhandled error: {   "stack": "Error: Connection terminated due to connection timeout\n    at Client._connectionCallback (/app/node_modules/.pnpm/pg-pool@3.14.0_pg@8.22.0/node_modules/pg-pool/index.js:276:17)\n    at Connection.<anonymous> (/app/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/client.js:212:18)\n    at Object.onceWrapper (node:events:633:28)\n    at Connection.emit (node:events:519:28)\n    at Socket.<anonymous> (/app/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/connection.js:63:12)\n    at Socket.emit (node:events:519:28)\n    at TCP.<anonymous> (node:net:347:12)\n    at TCP.callbackTrampoline (node:internal/async_hooks:130:17)",   "message": "Connection terminated due to connection timeout",   "cause": {     "stack": "Error: Connection terminated unexpectedly\n    at Connection.<anonymous> (/app/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/client.js:199:73)\n    at Object.onceWrapper (node:events:633:28)\n    at Connection.emit (node:events:519:28)\n    at Socket.<anonymous> (/app/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/connection.js:63:12)\n    at Socket.emit (node:events:519:28)\n    at TCP.<anonymous> (node:net:347:12)\n    at TCP.callbackTrampoline (node:internal/async_hooks:130:17)",     "me
  **Post-Mortem & Fix Analysis**:
  > docker run -d \   --name mcphub_pg_1 \   --restart unless-stopped \   -p 3003:3000 \   -e NODE_ENV=production \   -e PORT=3000 \   -e USE_DB=true \   -e 'DB_URL=postgresql://xxxxx' \   -e DB_POOL_SIZE=10 \   -e ADMIN_PASSWORD='admin' \   -e JWT_SECRET='442b0337-992c-4eeb-aca5-9f38ac7884c3' \   -v "$(pwd)/mcp_settings.json:/app/mcp_settings.json:ro" \   -v "$(pwd)/data:/app/data" \   --health-cmd 'wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1' \   --health-interval=30s \   --health-timeout=10s \   --health-retries=3 \   --health-start-period=60s \   samanhappy/mcphub:latest  附上我的docker启动指令
  > ## 诊断分析（基于源码逐行核对）  ### 错误日志的含义  日志里的两行错误在 pg/pg-pool 源码中语义确定：  - `Connection terminated due to connection timeout`：**新建**一条到 PostgreSQL 的 TCP 连接时，超过 `connectionTimeoutMillis`（本项目默认 60000ms，见 `src/db/connection.ts`）仍未建立成功，pg-pool 销毁了 socket。 - `Connection terminated unexpectedly`（cause）：连接建立过程中 socket 被关闭。  注意：如果是连接池耗尽，pg-pool 报的是另一条错误 `timeout exceeded when trying to connect`。你收到的是前者，说明**当时连接池并未满，是 PostgreSQL 服务端在 60 秒以上无法接受/完成新连接**（服务端过载、`max_connections` 打满、前置连接池器排队，或网络饱和），而不是池子参数问题。  ### `idle in transaction = 1` 与"服务 hold 住"的因果链  1. MCPHub 在 DB 模式下，**每个请求**都直接读数据库：`src/middlewares/index.ts` 每请求 `getSystemConfigDao().get()`，`src/middlewares/auth.ts` 每请求再读一次 system_config 并全表扫 `bearer_keys`（`findEnabled`）。高并发时 10 条 TypeORM 连接很容易饱和，任何 DB 抖动都会波及整个 HTTP 服务。 2. 任一请求读配置失败（`connection.*timeout` 命中重试规则）→ `SystemConfigRepository.withConnectionRecovery` → `reconnectDatabase()` → `attemptReconnection()` → 先 `dataSource.destroy()`。 3. TypeORM 的 `closePool` → `pool.end()` **没有任何超时**，而 pg-pool 的 

- **Issue #1144** (2026-09-09): **bug: session rebuild drops client capabilities, so MCP Apps clients get "Tool not available" after a restart**
  *Symptoms*: **Bug Description**  With enableSessionRebuild on, a session that is rebuilt after a restart has no client capabilities, because the rebuilt Server never received an initialize. For a client that advertises MCP Apps (Claude.ai does) on a single-server route, this changes the tool naming from raw ("get_orders") to prefixed ("myserver-get_orders"). The client keeps calling the raw names it cached before the restart and every call fails with:  ToolUnavailableError: Tool not available: get_orders at handleCallToolRequest (dist/services/mcpService.js:2720)  The connector stays broken until the user removes and re-adds it. Clients that do not advertise MCP Apps are not affected, since they always get prefixed names.  **Steps to Reproduce**  1. Run MCPHub in database mode with enableSessionRebuild set to true and one stdio server exposed on /mcp/myserver. Authenticate with a bearer key. 2. POST an initialize request to /mcp/myserver whose capabilities contain extensions["io.modelcontextprotocol/ui"] = {"mimeTypes": ["text/html;profile=mcp-app"]}. Call tools/list: names are raw ("get_orders"). Call tools/call with "get_orders": it works. 3. Restart MCPHub, or simply send the same tools/call with a random unknown mcp-session-id. The session is rebuilt and the response is "Error: Tool not available: get_orders". The same call with "myserver-get_orders" works, and tools/list on the rebuilt session returns prefixed names.  **Expected Behavior**  Tool names should not change for an existi

- **Issue #1110** (2026-08-31): **streamable-http 地址无法连接UnsafeUrlError**
  *Symptoms*: **Bug Description / 问题描述** What happened? / 发生了什么？ ` "serverName": "chrome-bridge",   "error": {     "name": "UnsafeUrlError",     "message": "Host localhost resolves to blocked address: 127.0.0.1",     "stack": "UnsafeUrlError: Host localhost resolves to blocked address: 127.0.0.1\n    at assertSafeUrl (file:///app/dist/utils/ssrf.js:118:19)\n    at async createTransportFromConfig (file:///app/dist/services/mcpService.js:892:9)\n    at async initializeClientsFromSettings (file:///app/dist/services/mcpService.js:1263:29)\n    at async toggleServerStatus (file:///app/dist/services/mcpService.js:1860:17)\n    at async toggleServer (file:///app/dist/controllers/serverController.js:787:24)"   } } ` **Steps to Reproduce / 复现步骤** 1. `"chrome-bridge": {       "enabled": true,       "owner": "guest",       "type": "streamable-http",       "options": {         "timeout": 10000,         "resetTimeoutOnProgress": true       },       "visibility": "private",       "url": "http://localhost:12306/mcp",       "enableKeepAlive": false     }`  **Expected Behavior / 预期行为** What should happen? / 应该发生什么？  **Environment / 运行环境** - Running on / 运行方式: docker - Version / 版本: v1.0.25  **Screenshots / 截图** If relevant, add screenshots / 如果有帮助的话，请添加截图  **Additional Info / 补充信息** Any other details? / 还有其他信息吗？ 
  **Post-Mortem & Fix Analysis**:
  > chrome-bridge需要通过本地streamable-http流链接, 因为客户端命令不在容器里面
  > 感谢反馈！这是 v1.0.25 的 SSRF 防护触发的：Docker 中 `localhost` 指向容器自身，且 `guest` 用户默认不能访问内网地址。可以尝试使用 `host.docker.internal:12306`，并由管理员创建或拥有该服务。我们也会补充 Docker 场景下的配置说明。
  > > 感谢反馈！这是 v1.0.25 的 SSRF 防护触发的：Docker 中 `localhost` 指向容器自身，且 `guest` 用户默认不能访问内网地址。可以尝试使用 `host.docker.internal:12306`，并由管理员创建或拥有该服务。我们也会补充 Docker 场景下的配置说明。  ``` 2026-08-31T03:51:34.278Z] [ERROR] [31] [main] [FATAL] Unhandled promise rejection {   "error": {     "stack": "UnsafeUrlError: Unable to resolve host: host.docker.internal\n    at assertSafeUrl (file:///app/dist/utils/ssrf.js:111:15)\n    at async createTransportFromConfig (file:///app/dist/services/mcpService.js:892:9)\n    at async initializeClientsFromSettings (file:///app/dist/services/mcpService.js:1263:29)\n    at async registerAllTools (file:///app/dist/services/mcpService.js:1423:5)\n    at async initUpstreamServers (file:///app/dist/services/mcpService.js:199:5)",     "message": "Unable to resolve host: host.docker.internal",     "name": "UnsafeUrlError"   } } ```

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

### Incident Patch 1: `f3d464f1` (2026-10-06)
**Commit Message**: fix: allow configuring stdio response buffer limits (#1284)

**File**: `docs/configuration/mcp-settings.mdx` (modified, +15/-0)
```diff
@@ -773,3 +773,18 @@ Common validation errors and solutions:
 4. **Command not found**: Verify installation and PATH */}
 
 This comprehensive guide covers all aspects of configuring MCP servers in MCPHub for various use cases and environments.
+
+### Stdio response buffer
+
+Set `options.maxBufferSize` to a positive safe integer in bytes to allow larger stdio responses:
+
+```json
+{
+  "type": "stdio",
+  "command": "node",
+  "args": ["server.js"],
+  "options": { "maxBufferSize": 268435456 }
+}
+```
+
+Omitting this option retains the SDK default of 10 MiB (10485760 bytes). The limit applies to the read buffer containing the serialized MCP message, including its envelope. A response that exceeds the limit closes the transport. Raising the limit allows greater memory use; choose a finite limit appropriate for the server. Zero, negative values, fractions, and non-finite values are rejected. This option does not change HTTP transports or the SDK's large-message processing performance.
```

**File**: `docs/zh/configuration/mcp-settings.mdx` (modified, +15/-0)
```diff
@@ -706,3 +706,18 @@ ls -la /path/to/server
 4. **找不到命令**：验证安装和 PATH
 
 这个全面的指南涵盖了在 MCPHub 中为各种用例和环境配置 MCP 服务器的所有方面。
+
+### Stdio 响应缓冲区
+
+将 `options.maxBufferSize` 设置为以字节为单位的正安全整数，可接收更大的 stdio 响应：
+
+```json
+{
+  "type": "stdio",
+  "command": "node",
+  "args": ["server.js"],
+  "options": { "maxBufferSize": 268435456 }
+}
+```
+
+省略该选项时保留 SDK 默认值 10 MiB（10485760 字节）。上限用于读取包含 MCP 消息封装的序列化数据的缓冲区。响应超过上限会关闭传输连接。提高上限会允许使用更多内存，请按服务器需求设置有限上限。零、负数、小数和非有限值均被拒绝。该选项不会改变 HTTP 传输或 SDK 处理大消息的性能。
```

**File**: `frontend/src/components/ServerForm.tsx` (modified, +30/-1)
```diff
@@ -132,6 +132,7 @@ const ServerForm = ({
     visibility: (initialData?.config?.visibility ?? 'private') as 'private' | 'group' | 'public',
     sharedWithUsers: initialData?.config?.sharedWithUsers || [],
     options: {
+      maxBufferSize: initialData?.config?.options?.maxBufferSize,
       timeout:
         (initialData &&
           initialData.config &&
@@ -410,7 +411,7 @@ const ServerForm = ({
 
   // Handle options changes
   const handleOptionsChange = (
-    field: 'timeout' | 'resetTimeoutOnProgress' | 'maxTotalTimeout',
+    field: 'timeout' | 'resetTimeoutOnProgress' | 'maxTotalTimeout' | 'maxBufferSize',
     value: number | boolean | undefined,
   ) => {
     setFormData((prev) => ({
@@ -2064,6 +2065,34 @@ const ServerForm = ({
                   {isRequestOptionsExpanded && (
                     <div className="border border-gray-200 dark:border-gray-700 rounded-b p-4 bg-gray-50 dark:bg-gray-800 border-t-0">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
+                        {serverType === 'stdio' && (
+                          <div>
+                            <label
+                              className="block text-gray-600 text-sm font-medium mb-1"
+                              htmlFor="maxBufferSize"
+                            >
+                              {t('server.maxBufferSize')}
+                            </label>
+                            <input
+                              type="number"
+                              id="maxBufferSize"
+                              value={formData.options?.maxBufferSize ?? ''}
+                              onChange={(e) =>
+                                handleOptionsChange(
+                                  'maxBufferSize',
+                                  e.target.value === '' ? undefined : Number(e.target.value),
+                                )
+                              }
+                              className="w-full py-2 px-3 form-input"
+                              placeholder="10485760"
+                              min="1"
+                              step="1"
+                            />
+                            <p className="text-xs text-gray-500 mt-1">
+                              {t('server.maxBufferSizeDescription')}
+                            </p>
+                          </div>
+                        )}
                         <div>
                           <label
                             className="block text-gray-600 text-sm font-medium mb-1"
```

**File**: `frontend/src/types/index.ts` (modified, +2/-0)
```diff
@@ -235,6 +235,7 @@ export interface ServerConfig {
     timeout?: number; // Request timeout in milliseconds
     resetTimeoutOnProgress?: boolean; // Reset timeout on progress notifications
     maxTotalTimeout?: number; // Maximum total timeout in milliseconds
+    maxBufferSize?: number; // Stdio read buffer limit in bytes
   }; // MCP request options configuration
   // Proxychains4 proxy configuration for STDIO servers (Linux/macOS only, Windows not supported)
   proxy?: ProxychainsConfig;
@@ -396,6 +397,7 @@ export interface ServerFormData {
     timeout?: number;
     resetTimeoutOnProgress?: boolean;
     maxTotalTimeout?: number;
+    maxBufferSize?: number;
   };
   // Proxychains4 proxy configuration for STDIO servers (Linux/macOS only).
   // Round-tripped from the stored config so an edit does not drop it.
```

**File**: `frontend/src/utils/serverFormPayload.ts` (modified, +7/-0)
```diff
@@ -63,6 +63,13 @@ const buildOptions = (options?: ServerFormData['options']) => {
     nextOptions.maxTotalTimeout = options.maxTotalTimeout;
   }
 
+  if (options?.maxBufferSize !== undefined) {
+    if (!Number.isSafeInteger(options.maxBufferSize) || options.maxBufferSize <= 0) {
+      throw new Error('options.maxBufferSize must be a positive safe integer in bytes');
+    }
+    nextOptions.maxBufferSize = options.maxBufferSize;
+  }
+
   return nextOptions;
 };
 
```

**File**: `locales/en.json` (modified, +2/-0)
```diff
@@ -191,6 +191,8 @@
     "disconnectOAuthSuccess": "Server OAuth disconnected",
     "disconnectOAuthError": "Failed to disconnect OAuth for server {{serverName}}",
     "requestOptions": "Connection Configuration",
+    "maxBufferSize": "Stdio buffer limit (bytes)",
+    "maxBufferSizeDescription": "Maximum stdio read buffer size. Leave blank for the SDK default (10 MiB). Larger limits allow higher memory use.",
     "timeout": "Request Timeout",
     "timeoutDescription": "Timeout for requests to the MCP server (ms)",
     "maxTotalTimeout": "Maximum Total Timeout",
```

**File**: `locales/fr.json` (modified, +2/-0)
```diff
@@ -191,6 +191,8 @@
     "disconnectOAuthSuccess": "OAuth du serveur déconnecté",
     "disconnectOAuthError": "Échec de la déconnexion OAuth du serveur {{serverName}}",
     "requestOptions": "Configuration de la connexion",
+    "maxBufferSize": "Limite du tampon stdio (octets)",
+    "maxBufferSizeDescription": "Taille maximale du tampon de lecture stdio. Laissez vide pour la valeur par défaut du SDK (10 Mio). Une limite supérieure permet une utilisation mémoire plus élevée.",
     "timeout": "Délai d'attente de la requête",
     "timeoutDescription": "Délai d'attente pour les requêtes vers le serveur MCP (ms)",
     "maxTotalTimeout": "Délai d'attente total maximum",
```

**File**: `locales/tr.json` (modified, +2/-0)
```diff
@@ -191,6 +191,8 @@
     "disconnectOAuthSuccess": "Sunucu OAuth bağlantısı kesildi",
     "disconnectOAuthError": "{{serverName}} sunucusunun OAuth bağlantısı kesilemedi",
     "requestOptions": "Bağlantı Yapılandırması",
+    "maxBufferSize": "Stdio arabellek sınırı (bayt)",
+    "maxBufferSizeDescription": "Stdio okuma arabelleğinin en büyük boyutu. SDK varsayılanı (10 MiB) için boş bırakın. Daha yüksek sınırlar daha fazla bellek kullanımına izin verir.",
     "timeout": "İstek Zaman Aşımı",
     "timeoutDescription": "MCP sunucusuna yapılan istekler için zaman aşımı (ms)",
     "maxTotalTimeout": "Maksimum Toplam Zaman Aşımı",
```

---

### Incident Patch 2: `01f4bb8b` (2026-10-04)
**Commit Message**: fix: restore remote keepalive after tool-call reconnect (#1281)

Co-authored-by: sunmeng <[REDACTED_EMAIL]>

**File**: `src/services/mcpService.ts` (modified, +1/-0)
```diff
@@ -1835,6 +1835,7 @@ const callToolWithReconnect = async (
             serverInfo.client = newClient;
             serverInfo.transport = newTransport;
             serverInfo.status = 'connected';
+            setupServerKeepAlive(serverInfo, server);
           }
 
           // Point the local refs at the new connection for the next attempt.
```

**File**: `tests/integration/mcpService-reconnect.test.ts` (modified, +106/-1)
```diff
@@ -103,7 +103,9 @@ jest.mock('../../src/services/activityLoggingService.js', () => ({
 }));
 
 jest.mock('../../src/services/keepAliveService.js', () => ({
-  setupClientKeepAlive: jest.fn().mockResolvedValue(undefined),
+  setupClientKeepAlive: jest.fn(
+    jest.requireActual('../../src/services/keepAliveService.js').setupClientKeepAlive,
+  ),
 }));
 
 const mockBaseFetch = jest.fn();
@@ -145,6 +147,7 @@ jest.mock('../../src/config/index.js', () => ({
   },
 }));
 
+import { setupClientKeepAlive } from '../../src/services/keepAliveService.js';
 import * as mcpService from '../../src/services/mcpService.js';
 describe('mcpService reconnect config integration', () => {
   beforeEach(() => {
@@ -169,6 +172,108 @@ describe('mcpService reconnect config integration', () => {
     };
   };
 
+  it.each([true, false])(
+    'preserves keepalive opt-in (%s) after shared tool reconnect',
+    async (enabled) => {
+      jest.useFakeTimers();
+      const config = {
+        name: 'clock-server',
+        type: 'streamable-http',
+        url: 'https://example.com/mcp',
+        enabled: true,
+        enableKeepAlive: enabled,
+        keepAliveInterval: 1000,
+      };
+      mockServerDao.findById.mockResolvedValueOnce(config);
+      const serverInfo = createServerInfo(jest.fn().mockRejectedValue({ status: 404 })) as any;
+      mcpService.setServerInfosForTest([serverInfo]);
+      try {
+        await setupClientKeepAlive(serverInfo, config);
+        const oldTimer = serverInfo.keepAliveIntervalId;
+        jest.mocked(setupClientKeepAlive).mockClear();
+        const result = await mcpService.handleCallToolRequest(
+          {
+            params: {
+              name: 'call_tool',
+              arguments: { toolName: 'clock-server::get_current_time', arguments: {} },
+            },
+          },
+          { sessionId: 'session-keepalive', server: 'clock-server' },
+        );
+        expect(result.isError).toBe(false);
+        expect(jest.getTimerCount()).toBe(enabled ? 1 : 0);
+        if (enabled) {
+          expect(serverInfo.keepAliveIntervalId).toBeDefined();
+          expect(serverInfo.keepAliveIntervalId).not.toBe(oldTimer);
+          expect(setupClientKeepAlive).toHaveBeenCalledWith(serverInfo, config, {
+            reconnectServer: expect.any(Function),
+          });
+          // A later outage must still be detected by the replacement timer.
+          mockReconnectClient.listTools.mockRejectedValueOnce(new Error('upstream offline'));
+          await jest.advanceTimersByTimeAsync(1000);
+          expect(serverInfo.status).toBe('disconnected');
+          expect(serverInfo.error).toContain('upstream offline');
+          const configReads = mockServerDao.findById.mock.calls.length;
+          await jest.advanceTimersByTimeAsync(1000);
+          expect(mockServerDao.findById.mock.calls.length).toBeGreaterThan(configReads);
+          expect(mockServerDao.findAll).toHaveBeenCalledTimes(1);
+        }
+      } finally {
+        jest.clearAllTimers();
+        jest.useRealTimers();
+        mcpService.setServerInfosForTest([]);
+      }
+    },
+  );
+
+  it('does not replace the shared keepalive timer on isolated session reconnect', async () => {
+    jest.useFakeTimers();
+    const config = {
+      name: 'clock-server',
+      type: 'streamable-http',
+      url: 'https://example.com/mcp',
+      enabled: true,
+      perSessionClient: true,
+      enableKeepAlive: true,
+      keepAliveInterval: 1000,
+    };
+    mockServerDao.findById.mockResolvedValueOnce(config);
+    const serverInfo = createServerInfo(jest.fn()) as any;
+    serverInfo.config = config;
+    const sharedClient = serverInfo.client;
+    const sharedTransport = serverInfo.transport;
+    mockReconnectClient.callTool.mockRejectedValueOnce({ status: 404 });
+    mcpService.setServerInfosForTest([serverInfo]);
+    try {
+      await setupClientKeepAlive(serverInfo, config);
+      const sharedTimer = serverInfo.keepAliveIntervalId;
+      jest.mocked(setupClientKeepAlive).mockClear();
+      const result = await mcpService.handleCallToolRequest(
+        {
+          params: {
+            name: 'call_tool',
+            arguments: { toolName: 'clock-server::get_current_time', arguments: {} },
+          },
+        },
+        { sessionId: 'session-isolated-keepalive', server: 'clock-server' },
+      );
+      expect(result.isError).toBe(false);
+      expect(mockReconnectClient.connect).toHaveBeenCalledTimes(2);
+      expect(serverInfo.client).toBe(sharedClient);
+      expect(serverInfo.transport).toBe(sharedTransport);
+      expect(serverInfo.keepAliveIntervalId).toBe(sharedTimer);
+      expect(jest.getTimerCount()).toBe(1);
+      expect(setupClientKeepAlive).not.toHaveBeenCalled();
+      expect(sharedClient.close).not.toHaveBeenCalled();
+      expect(sharedTransport.close).not.toHaveBeenCalled();
+    } finally {
+      mcpService.deleteMcpServer('session-isolated-keepalive');
+      jest.clearAllTi
```

---

### Incident Patch 3: `dd7e5d85` (2026-10-04)
**Commit Message**: fix(deps): patch vulnerable transitive dependencies (#1280)

Co-authored-by: sunmeng <[REDACTED_EMAIL]>

**File**: `package.json` (modified, +4/-7)
```diff
@@ -164,20 +164,17 @@
       "follow-redirects": "1.16.0",
       "@babel/core": "7.29.6",
       "@protobufjs/utf8": "1.1.1",
-      "fast-uri": "^3.1.5",
+      "fast-uri": "^3.1.8",
       "form-data": "4.0.6",
-      "ip-address": "^10.3.1",
+      "ip-address": "^10.7.1",
       "protobufjs": "^7.6.5",
       "shell-quote": "^1.9.0",
       "ws": "8.21.0",
       "body-parser@<2": "^1.20.6",
       "body-parser@>=2": "^2.3.0",
-      "brace-expansion@1.1.11": "^1.1.16",
-      "brace-expansion@1.1.12": "^1.1.16",
+      "brace-expansion@>=1 <2": "^1.1.21",
       "brace-expansion@2.0.1": "2.0.2",
-      "brace-expansion@5.0.4": "^5.0.9",
-      "brace-expansion@5.0.5": "^5.0.9",
-      "brace-expansion@5.0.6": "^5.0.9",
+      "brace-expansion@>=4 <6": "^5.0.12",
       "defu@6.1.4": "6.1.6",
       "diff": "4.0.4",
       "express-rate-limit": "8.3.0",
```

**File**: `pnpm-lock.yaml` (modified, +66/-26)
```diff
@@ -9,20 +9,15 @@ overrides:
   follow-redirects: 1.16.0
   '@babel/core': 7.29.6
   '@protobufjs/utf8': 1.1.1
-  fast-uri: ^3.1.5
+  fast-uri: ^3.1.8
   form-data: 4.0.6
-  ip-address: ^10.3.1
+  ip-address: ^10.7.1
   protobufjs: ^7.6.5
   shell-quote: ^1.9.0
   ws: 8.21.0
   body-parser@<2: ^1.20.6
   body-parser@>=2: ^2.3.0
-  brace-expansion@1.1.11: ^1.1.16
-  brace-expansion@1.1.12: ^1.1.16
   brace-expansion@2.0.1: 2.0.2
-  brace-expansion@5.0.4: ^5.0.9
-  brace-expansion@5.0.5: ^5.0.9
-  brace-expansion@5.0.6: ^5.0.9
   defu@6.1.4: 6.1.6
   diff: 4.0.4
   express-rate-limit: 8.3.0
@@ -48,6 +43,8 @@ overrides:
   rollup: 4.59.0
   tar@7.5.10: 7.5.13
   uuid: 14.0.0
+  brace-expansion@>=1 <2: ^1.1.21
+  brace-expansion@>=4 <6: ^5.0.12
 
 pnpmfileChecksum: sha256-3bo+X3m9acxXSC0vVE085iGfn+vmN/CIgtnT24S01fc=
 
@@ -1534,66 +1531,79 @@ packages:
     resolution: {integrity: sha512-t4ONHboXi/3E0rT6OZl1pKbl2Vgxf9vJfWgmUoCEVQVxhW6Cw/c8I6hbbu7DAvgp82RKiH7TpLwxnJeKv2pbsw==}
     cpu: [arm]
     os: [linux]
+    libc: [glibc]
 
   '@rollup/rollup-linux-arm-musleabihf@4.59.0':
     resolution: {integrity: sha512-CikFT7aYPA2ufMD086cVORBYGHffBo4K8MQ4uPS/ZnY54GKj36i196u8U+aDVT2LX4eSMbyHtyOh7D7Zvk2VvA==}
     cpu: [arm]
     os: [linux]
+    libc: [musl]
 
   '@rollup/rollup-linux-arm64-gnu@4.59.0':
     resolution: {integrity: sha512-jYgUGk5aLd1nUb1CtQ8E+t5JhLc9x5WdBKew9ZgAXg7DBk0ZHErLHdXM24rfX+bKrFe+Xp5YuJo54I5HFjGDAA==}
     cpu: [arm64]
     os: [linux]
+    libc: [glibc]
 
   '@rollup/rollup-linux-arm64-musl@4.59.0':
     resolution: {integrity: sha512-peZRVEdnFWZ5Bh2KeumKG9ty7aCXzzEsHShOZEFiCQlDEepP1dpUl/SrUNXNg13UmZl+gzVDPsiCwnV1uI0RUA==}
     cpu: [arm64]
     os: [linux]
+    libc: [musl]
 
   '@rollup/rollup-linux-loong64-gnu@4.59.0':
     resolution: {integrity: sha512-gbUSW/97f7+r4gHy3Jlup8zDG190AuodsWnNiXErp9mT90iCy9NKKU0Xwx5k8VlRAIV2uU9CsMnEFg/xXaOfXg==}
     cpu: [loong64]
     os: [linux]
+    libc: [glibc]
 
   '@rollup/rollup-linux-loong64-musl@4.59.0':
     resolution: {integrity: sha512-yTRONe79E+o0FWFijasoTjtzG9EBedFXJMl888NBEDCDV9I2wGbFFfJQQe63OijbFCUZqxpHz1GzpbtSFikJ4Q==}
     cpu: [loong64]
     os: [linux]
+    libc: [musl]
 
   '@rollup/rollup-linux-ppc64-gnu@4.59.0':
     resolution: {integrity: sha512-sw1o3tfyk12k3OEpRddF68a1unZ5VCN7zoTNtSn2KndUE+ea3m3ROOKRCZxEpmT9nsGnogpFP9x6mnLTCaoLkA==}
     cpu: [ppc64]
     os: [linux]
+    libc: [glibc]
 
   '@rollup/rollup-linux-ppc64-musl@4.59.0':
     resolution: {integrity: sha512-+2kLtQ4xT3AiIxkzFVFXfsmlZiG5FXYW7ZyIIvGA7Bdeuh9Z0aN4hVyXS/G1E9bTP/vqszNIN/pUKCk/BTHsKA==}
     cpu: [ppc64]
     os: [linux]
+    libc: [musl]
 
   '@rollup/rollup-linux-riscv64-gnu@4.59.0':
     resolution: {integrity: sha512-NDYMpsXYJJaj+I7UdwIuHHNxXZ/b/N2hR15NyH3m2qAtb/hHPA4g4SuuvrdxetTdndfj9b1WOmy73kcPRoERUg==}
     cpu: [riscv64]
     os: [linux]
+    libc: [glibc]
 
   '@rollup/rollup-linux-riscv64-musl@4.59.0':
     resolution: {integrity: sha512-nLckB8WOqHIf1bhymk+oHxvM9D3tyPndZH8i8+35p/1YiVoVswPid2yLzgX7ZJP0KQvnkhM4H6QZ5m0LzbyIAg==}
     cpu: [riscv64]
     os: [linux]
+    libc: [musl]
 
   '@rollup/rollup-linux-s390x-gnu@4.59.0':
     resolution: {integrity: sha512-oF87Ie3uAIvORFBpwnCvUzdeYUqi2wY6jRFWJAy1qus/udHFYIkplYRW+wo+GRUP4sKzYdmE1Y3+rY5Gc4ZO+w==}
     cpu: [s390x]
     os: [linux]
+    libc: [glibc]
 
   '@rollup/rollup-linux-x64-gnu@4.59.0':
     resolution: {integrity: sha512-3AHmtQq/ppNuUspKAlvA8HtLybkDflkMuLK4DPo77DfthRb71V84/c4MlWJXixZz4uruIH4uaa07IqoAkG64fg==}
     cpu: [x64]
     os: [linux]
+    libc: [glibc]
 
   '@rollup/rollup-linux-x64-musl@4.59.0':
     resolution: {integrity: sha512-2UdiwS/9cTAx7qIUZB/fWtToJwvt0Vbo0zmnYt7ED35KPg13Q0ym1g442THLC7VyI6JfYTP4PiSOWyoMdV2/xg==}
     cpu: [x64]
     os: [linux]
+    libc: [musl]
 
   '@rollup/rollup-openbsd-x64@4.59.0':
     resolution: {integrity: sha512-M3bLRAVk6GOwFlPTIxVBSYKUaqfLrn8l0psKinkCFxl4lQvOSz8ZrKDz2gxcBwHFpci0B6rttydI4IpS4IS/jQ==}
@@ -1670,36 +1680,42 @@ packages:
     engines: {node: '>=10'}
     cpu: [arm64]
     os: [linux]
+    libc: [glibc]
 
   '@swc/core-linux-arm64-musl@1.15.32':
     resolution: {integrity: sha512-omcqjoZP/b8D8PuczVoRwJieC6ibj7qIxTftNYokz4/aSmKFHvsd7nIFfPk5ZvtzncbH4AY7+Dkr/Lp2gWxYeA==}
     engines: {node: '>=10'}
     cpu: [arm64]
     os: [linux]
+    libc: [musl]
 
   '@swc/core-linux-ppc64-gnu@1.15.32':
     resolution: {integrity: sha512-KGkTMyz/Tbn3PBNu0AVZ4GTDFKnICrYcTiNPZq8DrvK42pnFsf3GNDrIG9E5AtQlTmC0YigkWKmu0eMcfTrmgA==}
     engines: {node: '>=10'}
     cpu: [ppc64]
     os: [linux]
+    libc: [glibc]
 
   '@swc/core-linux-s390x-gnu@1.15.32':
     resolution: {integrity: sha512-G3Aa4tVS/3OGZBkoNIwUF9F6RAy+Osb4GOlo62SinLmDiErz/ykmM7KH0wkz6l9kM8jJq1HyAM6atJTUEbBk7g==}
     engines: {node: '>=10'}
     cpu: [s390x]
     os: [linux]
+    libc: [glibc]
 
   '@swc/core-linux-x64-gnu@1.15.32':
     resolution: {integrity: sha512-ERsjfGcj6CBmj3vJnGDO8m8rTvw6RqMcWo1dogOtNx3/+/0+NNpJiXDobJrr1GwInI/BHAEkvSFIH6d2LqPcUQ==}
     engines: {node: '>=10'}
     cp
```

---

### Incident Patch 4: `f5a764f2` (2026-10-04)
**Commit Message**: fix: prevent JSON DAO settings updates from overwriting each other (#1279)

**File**: `src/config/index.ts` (modified, +11/-5)
```diff
@@ -44,9 +44,12 @@ const ensureOAuthServerDefaults = (settings: McpSettings): boolean => {
 // Settings cache
 let settingsCache: McpSettings | null = null;
 // mtime of the settings file our cache snapshot was read from. The file is
-// re-read when it is newer, mirroring JsonFileBaseDao so system settings do
+// re-read when it changes, mirroring JsonFileBaseDao so system settings do
 // not behave differently from server definitions on external edits (#1081).
 let lastModified = 0;
+// In-process writes can share the same filesystem mtime.
+let settingsGeneration = 0;
+export const getSettingsGeneration = (): number => settingsGeneration;
 
 export const getSettingsPath = (): string => {
   return getConfigFilePath('mcp_settings.json', 'Settings');
@@ -57,7 +60,7 @@ export const loadOriginalSettings = (): McpSettings => {
   if (settingsCache) {
     try {
       const stats = fs.statSync(getSettingsPath());
-      if (lastModified >= stats.mtime.getTime()) {
+      if (lastModified === stats.mtimeMs) {
         return settingsCache;
       }
     } catch {
@@ -86,6 +89,7 @@ export const loadOriginalSettings = (): McpSettings => {
     if (initialized) {
       try {
         fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
+        clearSettingsCache();
       } catch (writeError) {
         logger.error('Failed to persist default OAuth server configuration', {
           writeError,
@@ -97,7 +101,7 @@ export const loadOriginalSettings = (): McpSettings => {
     // Update cache
     settingsCache = settings;
     try {
-      lastModified = fs.statSync(settingsPath).mtime.getTime();
+      lastModified = fs.statSync(settingsPath).mtimeMs;
     } catch {
       lastModified = Date.now();
     }
@@ -119,9 +123,10 @@ export const saveSettings = (settings: McpSettings, user?: IUser): boolean => {
     const mergedSettings = dataService.mergeSettings!(loadOriginalSettings(), settings, user);
     fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2), 'utf8');
 
-    // Update cache after successful save
+    // Invalidate every DAO snapshot, including writes in the same mtime tick.
+    clearSettingsCache();
     settingsCache = mergedSettings;
-    lastModified = Date.now();
+    lastModified = fs.statSync(settingsPath).mtimeMs;
 
     return true;
   } catch (error) {
@@ -134,6 +139,7 @@ export const saveSettings = (settings: McpSettings, user?: IUser): boolean => {
  * Clear settings cache, force next loadSettings call to re-read from file
  */
 export const clearSettingsCache = (): void => {
+  settingsGeneration += 1;
   settingsCache = null;
   lastModified = 0;
 };
```

**File**: `src/dao/base/JsonFileBaseDao.ts` (modified, +13/-7)
```diff
@@ -1,7 +1,7 @@
 import fs from 'fs';
 import path from 'path';
 import { McpSettings } from '../../types/index.js';
-import { getSettingsPath, clearSettingsCache } from '../../config/index.js';
+import { getSettingsPath, clearSettingsCache, getSettingsGeneration } from '../../config/index.js';
 import { logger } from '../../utils/logger.js';
 
 /**
@@ -10,6 +10,7 @@ import { logger } from '../../utils/logger.js';
 export abstract class JsonFileBaseDao {
   private settingsCache: McpSettings | null = null;
   private lastModified: number = 0;
+  private settingsGeneration = -1;
 
   /**
    * Load settings from JSON file with caching
@@ -18,10 +19,14 @@ export abstract class JsonFileBaseDao {
     try {
       const settingsPath = getSettingsPath();
       const stats = fs.statSync(settingsPath);
-      const fileModified = stats.mtime.getTime();
+      const fileModified = stats.mtimeMs;
 
       // Check if cache is still valid
-      if (this.settingsCache && this.lastModified >= fileModified) {
+      if (
+        this.settingsCache &&
+        this.settingsGeneration === getSettingsGeneration() &&
+        this.lastModified === fileModified
+      ) {
         return this.settingsCache;
       }
 
@@ -31,6 +36,7 @@ export abstract class JsonFileBaseDao {
       // Update cache
       this.settingsCache = settings;
       this.lastModified = fileModified;
+      this.settingsGeneration = getSettingsGeneration();
 
       return settings;
     } catch (error) {
@@ -65,11 +71,11 @@ export abstract class JsonFileBaseDao {
 
       fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
 
-      // Update cache
-      this.settingsCache = settings;
-      this.lastModified = Date.now();
-
+      // Invalidate sibling DAOs even when filesystem timestamps are equal.
       clearSettingsCache();
+      this.settingsCache = settings;
+      this.lastModified = fs.statSync(settingsPath).mtimeMs;
+      this.settingsGeneration = getSettingsGeneration();
     } catch (error) {
       logger.error(`Failed to save settings:`, error);
       throw error;
```

**File**: `tests/dao/json-settings-cache.test.ts` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+import fs from 'fs';
+import os from 'os';
+import path from 'path';
+
+// Force every write into the same filesystem clock tick, reproducing #1242
+// deterministically without depending on the host filesystem's resolution.
+describe('JSON settings cache coherence (#1242)', () => {
+  let directory: string;
+  let settingsPath: string;
+  let originalPath: string | undefined;
+  const timestamp = new Date('2020-01-01T00:00:00Z');
+
+  beforeEach(() => {
+    jest.resetModules();
+    originalPath = process.env.MCPHUB_SETTING_PATH;
+    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcphub-cache-'));
+    settingsPath = path.join(directory, 'settings.json');
+    process.env.MCPHUB_SETTING_PATH = settingsPath;
+    fs.writeFileSync(
+      settingsPath,
+      JSON.stringify({
+        mcpServers: { notes: { command: 'node' } },
+        users: [],
+        groups: [{ id: 'g', name: 'g', servers: ['notes'] }],
+        systemConfig: { oauthServer: { enabled: false } },
+      }),
+    );
+    fs.utimesSync(settingsPath, timestamp, timestamp);
+    const write = fs.writeFileSync.bind(fs);
+    jest.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
+      write(...args);
+      if (args[0] === settingsPath) fs.utimesSync(settingsPath, timestamp, timestamp);
+    });
+  });
+
+  afterEach(() => {
+    jest.restoreAllMocks();
+    if (originalPath === undefined) delete process.env.MCPHUB_SETTING_PATH;
+    else process.env.MCPHUB_SETTING_PATH = originalPath;
+    fs.rmSync(directory, { recursive: true, force: true });
+    jest.resetModules();
+  });
+
+  it('preserves group updates through rename and the subsequent server save', async () => {
+    const { ServerDaoImpl } = await import('../../src/dao/ServerDao.js');
+    const { GroupDaoImpl } = await import('../../src/dao/GroupDao.js');
+    const servers = new ServerDaoImpl();
+    const groups = new GroupDaoImpl();
+    await groups.findAll();
+    expect(await servers.rename('notes', 'notebook')).toBe(true);
+    expect(await groups.updateServerName('notes', 'notebook')).toBe(1);
+    await servers.update('notebook', { enabled: true });
+    const stored = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
+    expect(stored.groups[0].servers).toEqual(['notebook']);
+    expect(stored.mcpServers.notebook.enabled).toBe(true);
+    expect(stored.mcpServers.notes).toBeUndefined();
+  });
+
+  it('invalidates DAO snapshots after a configuration-module save', async () => {
+    const config = await import('../../src/config/index.js');
+    const { ServerDaoImpl } = await import('../../src/dao/ServerDao.js');
+    const servers = new ServerDaoImpl();
+    await servers.findAll();
+    const settings = config.loadOriginalSettings();
+    settings.groups![0].servers = ['notebook'];
+    expect(config.saveSettings(settings)).toBe(true);
+    await servers.update('notes', { enabled: true });
+    expect(config.loadOriginalSettings().groups![0].servers).toEqual(['notebook']);
+  });
+  it('keeps an unchanged DAO snapshot cached but reloads on a backwards external mtime', async () => {
+    const { ServerDaoImpl } = await import('../../src/dao/ServerDao.js');
+    const servers = new ServerDaoImpl();
+    const read = jest.spyOn(fs, 'readFileSync');
+    await servers.findAll();
+    read.mockClear();
+    await servers.findAll();
+    expect(read).not.toHaveBeenCalled();
+    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
+    settings.mcpServers.notes.enabled = false;
+    fs.writeFileSync(settingsPath, JSON.stringify(settings));
+    const earlier = new Date(timestamp.getTime() - 1000);
+    fs.utimesSync(settingsPath, earlier, earlier);
+    expect((await servers.findById('notes'))?.enabled).toBe(false);
+  });
+
+  it('reloads configuration after an external edit older than the wall clock', async () => {
+    const config = await import('../../src/config/index.js');
+    expect(config.saveSettings(config.loadOriginalSettings())).toBe(true);
+    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
+    settings.systemConfig.nameSeparator = 'changed';
+    fs.writeFileSync(settingsPath, JSON.stringify(settings));
+    const later = new Date(timestamp.getTime() + 1000);
+    fs.utimesSync(settingsPath, later, later);
+    expect(config.loadOriginalSettings().systemConfig?.nameSeparator).toBe('changed');
+  });
+});
```

---

### Incident Patch 5: `377564b3` (2026-10-03)
**Commit Message**: fix(mcp): ignore legacy session scope for modern requests (#1273)

**File**: `src/services/sseService.ts` (modified, +15/-8)
```diff
@@ -530,8 +530,12 @@ const validateBearerAuth = async (req: Request): Promise<BearerAuthResult> => {
 };
 
 // Recheck every request, including existing sessions and smart group routes.
-const authorizeGroupRoute = async (req: Request, res: Response): Promise<boolean> => {
-  const sessionId = getRequestSessionId(req);
+const authorizeGroupRoute = async (
+  req: Request,
+  res: Response,
+  legacySession = true,
+): Promise<boolean> => {
+  const sessionId = legacySession ? getRequestSessionId(req) : undefined;
   const session = sessionId ? transports[sessionId] : undefined;
   if (session && !(await groupRouteReferencesMatch(req.params.group, session.group))) {
     res.status(403).json({ error: 'forbidden', error_description: 'Session route mismatch' });
@@ -896,9 +900,14 @@ export const handleMcpPostRequest = async (req: Request, res: Response): Promise
   // User context is now set by sseUserContextMiddleware
   const userContextService = UserContextService.getInstance();
 
-  // Streamable HTTP clients may continue an existing session on the global route.
-  // Reuse the session's group before bearer-scope validation in that case.
-  attachSessionGroupToRequest(req);
+  // Classify before restoring legacy session scope. Modern routing and auth must
+  // depend on the request URL, not on an unrelated legacy session ID.
+  const webRequest = await toWebRequest(req, req.body);
+  const legacyRequest = await isLegacyRequest(webRequest, req.body);
+  if (legacyRequest) {
+    // Legacy clients may continue a group session through the global route.
+    attachSessionGroupToRequest(req);
+  }
 
   // Check bearer auth using filtered settings
   const bearerAuthResult = await validateBearerAuth(req);
@@ -908,7 +917,7 @@ export const handleMcpPostRequest = async (req: Request, res: Response): Promise
   }
 
   attachUserContextFromBearer(bearerAuthResult, res);
-  if (!(await authorizeGroupRoute(req, res))) return;
+  if (!(await authorizeGroupRoute(req, res, legacyRequest))) return;
 
   const currentUser = userContextService.getCurrentUser();
   const username = currentUser?.username;
@@ -935,8 +944,6 @@ export const handleMcpPostRequest = async (req: Request, res: Response): Promise
   // MCP 2026-07-28 is stateless over HTTP. Keep the existing sessionful
   // Streamable HTTP path for 2025-era clients, and let the SDK's own
   // classifier route modern (or malformed-modern) traffic to createMcpHandler.
-  const webRequest = await toWebRequest(req, req.body);
-  const legacyRequest = await isLegacyRequest(webRequest, req.body);
   if (!legacyRequest) {
     logger.log(
       `[MCP 2026] Handling stateless request in group: ${group || 'global'}${username ? ` for user: ${username}` : ''}`,
```

**File**: `tests/integration/sse-service-real-client.test.ts` (modified, +62/-0)
```diff
@@ -32,6 +32,7 @@ import {
 import type { ServerInfo } from '../../src/types/index.js';
 import { transports } from '../../src/services/sseService.js';
 import { MCP_APPS_CAPABILITIES } from '../../src/utils/mcpApps.js';
+import { getSystemConfigDao } from '../../src/dao/index.js';
 
 describe('Real Client Transport Integration Tests', () => {
   let _appServer: AppServer;
@@ -260,6 +261,67 @@ describe('Real Client Transport Integration Tests', () => {
   });
 
   describe('MCP 2026-07-28 Dual-stack Tests', () => {
+    it('ignores legacy session scope when authorizing modern global routing', async () => {
+      const transport = new StreamableHTTPClientTransport(
+        new URL(`${baseURL}/mcp/integration-test-group`),
+        { requestInit: { headers: { Authorization: 'Bearer test-auth-token-123' } } },
+      );
+      const client = new Client({ name: 'legacy-route-boundary', version: '1.0.0' });
+      const dao = getSystemConfigDao();
+      const systemConfig = await dao.get();
+      let configSpy: jest.SpyInstance | undefined;
+      try {
+        await client.connect(transport);
+        expect(transport.sessionId).toBeDefined();
+        configSpy = jest.spyOn(dao, 'get');
+        for (const enableGlobalRoute of [false, true]) {
+          configSpy.mockResolvedValue({
+            ...systemConfig,
+            routing: { ...systemConfig?.routing, enableGlobalRoute },
+          });
+          for (const sessionSource of ['none', 'header', 'query']) {
+            const response = await fetch(
+              `${baseURL}/mcp${sessionSource === 'query' ? `?sessionId=${transport.sessionId}` : ''}`,
+              {
+                method: 'POST',
+                headers: {
+                  Authorization: 'Bearer test-auth-token-123',
+                  'Content-Type': 'application/json',
+                  Accept: 'application/json, text/event-stream',
+                  'MCP-Protocol-Version': '2026-07-28',
+                  'Mcp-Method': 'tools/list',
+                  ...(sessionSource === 'header' ? { 'Mcp-Session-Id': transport.sessionId! } : {}),
+                },
+                body: JSON.stringify({
+                  jsonrpc: '2.0',
+                  id: 1,
+                  method: 'tools/list',
+                  params: {
+                    _meta: {
+                      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
+                      'io.modelcontextprotocol/clientCapabilities': {},
+                    },
+                  },
+                }),
+              },
+            );
+            expect({ source: sessionSource, status: response.status }).toEqual({
+              source: sessionSource,
+              status: enableGlobalRoute ? 200 : 403,
+            });
+            if (enableGlobalRoute) {
+              expect((await response.json()).result.tools).toBeDefined();
+            } else {
+              expect(await response.text()).toContain('Global routes are disabled');
+            }
+          }
+        }
+      } finally {
+        configSpy?.mockRestore();
+        await client.close();
+      }
+    });
+
     it('validates routing headers before dispatch and preserves route and auth boundaries', async () => {
       const info = getServerByName('test-server-1')!;
       const original = {
```

---

### Incident Patch 6: `a5c224f9` (2026-10-03)
**Commit Message**: fix(security): isolate server configuration environment (#1270)

**File**: `src/controllers/oauthCallbackController.ts` (modified, +2/-2)
```diff
@@ -23,7 +23,7 @@ import {
   createTransportFromConfig,
   updateServerToolsCache,
 } from '../services/mcpService.js';
-import { replaceEnvVars } from '../config/index.js';
+import { expandServerConfig } from '../services/serverConfigEnvironment.js';
 import { loadServerConfig } from '../services/oauthSettingsStore.js';
 import { validateAuthorizationIss } from '../utils/oauthIssuer.js';
 import type { ServerInfo } from '../types/index.js';
@@ -388,7 +388,7 @@ export const handleOAuthCallback = async (req: Request, res: Response) => {
         // have environment variable references expanded, consistent with initial server setup.
         const freshConfig = await loadServerConfig(serverInfo.name);
         const effectiveConfig = freshConfig
-          ? (replaceEnvVars(freshConfig as any) as typeof freshConfig)
+          ? await expandServerConfig(freshConfig)
           : serverInfo.config;
 
         if (!effectiveConfig) {
```

**File**: `src/services/mcpService.ts` (modified, +6/-8)
```diff
@@ -1,3 +1,4 @@
+import { expandServerConfig, getServerEnvironment } from './serverConfigEnvironment.js';
 import { getMcpRequestGroup } from '../utils/mcpRequestGroup.js';
 import { LegacyMcpClient } from '../clients/legacyMcpClient.js';
 import { LEGACY_PROTOCOL_VERSIONS } from '../utils/mcpProtocol.js';
@@ -1556,10 +1557,7 @@ const stripAuthorizationHeader = (headers: Record<string, string>): Record<strin
 
 export const createTransportFromConfig = async (name: string, conf: ServerConfig): Promise<any> => {
   let transport;
-  const env: Record<string, string> = {
-    ...(process.env as Record<string, string>),
-    ...(hasCredentialTemplate(conf) ? conf.env : replaceEnvVars(conf.env || {})),
-  };
+  const env = await getServerEnvironment(conf);
 
   // The encryption key belongs only to the hub, never to a child process.
   delete env.MCPHUB_CREDENTIAL_ENCRYPTION_KEY;
@@ -1682,7 +1680,7 @@ export const createTransportFromConfig = async (name: string, conf: ServerConfig
     }
 
     // Apply proxychains4 wrapper if proxy is configured (Linux/macOS only)
-    let resolvedArgs = replaceEnvVars(conf.args ?? []) as string[];
+    let resolvedArgs = replaceEnvVars(conf.args ?? [], env) as string[];
 
     // If this server is pending a reinstall, inject cache-busting flags (uvx only).
     // For npx, the cache directory was already cleared before reconnect.
@@ -1779,7 +1777,7 @@ const callToolWithReconnect = async (
           }
 
           // Match initial connection expansion before URL validation and transport creation.
-          const server = replaceEnvVars(rawConfig) as ServerConfigWithName;
+          const server = await expandServerConfig(rawConfig);
           const newTransport = await createTransportFromConfig(serverInfo.name, server);
           const newClient = createUpstreamMcpClient(serverInfo.name, () => serverInfo);
 
@@ -1926,7 +1924,7 @@ export const initializeClientsFromSettings = async (
       }
 
       // Expand environment variables in all configuration values
-      const expandedConf = replaceEnvVars(conf as any) as ServerConfigWithName;
+      const expandedConf = await expandServerConfig(conf);
 
       // Skip disabled servers
       if (expandedConf.enabled === false) {
@@ -3164,7 +3162,7 @@ const ensureServerReady = async (serverInfo: ServerInfo): Promise<void> => {
     if (rawConfig.enabled === false) {
       throw new Error(`Cannot start disabled on-demand server: ${rawConfig.name}`);
     }
-    const expandedConf = replaceEnvVars(rawConfig as any) as ServerConfigWithName;
+    const expandedConf = await expandServerConfig(rawConfig);
 
     // startOnDemand is a stdio-only optimisation; OpenAPI/HTTP servers have no
     // deferred process to spawn, so there is nothing to wake.
```

**File**: `src/services/principalRuntimeService.ts` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ import { getServerDao } from '../dao/DaoFactory.js';
 import { credentialBindingEvents, resolveCredentialBinding } from './credentialBindingService.js';
 import { authorizationService, type RequestPrincipal } from './authorizationService.js';
 import { CredentialBindingError, hasCredentialTemplate } from '../utils/credentialTemplate.js';
-import { replaceEnvVars } from '../config/index.js';
+import { expandServerConfig } from './serverConfigEnvironment.js';
 import type { ServerConfig, ServerInfo } from '../types/index.js';
 
 interface RuntimeEntry {
@@ -58,7 +58,7 @@ export class PrincipalRuntimeService {
     const resolved = await resolveCredentialBinding(
       serverName,
       principal.username,
-      replaceEnvVars(definition) as ServerConfig,
+      await expandServerConfig(definition),
     );
     const revision = JSON.stringify([definitionSnapshot, resolved.revision]);
     const key = JSON.stringify([serverName, principal.username]);
```

**File**: `src/services/serverConfigEnvironment.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { replaceEnvVars } from '../config/index.js';
+import { getUserDao } from '../dao/index.js';
+import { hasCredentialTemplate } from '../utils/credentialTemplate.js';
+import type { ServerConfig } from '../types/index.js';
+
+/** Ownerless operator configuration is trusted; missing owners fail closed. */
+export const getServerEnvironment = async (
+  config: ServerConfig,
+): Promise<Record<string, string>> => {
+  const trusted =
+    !config.owner || (await getUserDao().findByUsername(config.owner))?.isAdmin === true;
+  const source = trusted ? process.env : {};
+  return {
+    ...(source as Record<string, string>),
+    ...(hasCredentialTemplate(config) ? config.env : replaceEnvVars(config.env || {}, source)),
+  };
+};
+
+export const expandServerConfig = async <T extends ServerConfig>(config: T): Promise<T> => {
+  const { owner, visibility, sharedWithUsers, ...transportConfig } = config;
+  // Authorization metadata is literal and must never be controlled by expansion values.
+  return {
+    ...replaceEnvVars(transportConfig, await getServerEnvironment(config)),
+    owner,
+    visibility,
+    sharedWithUsers,
+  } as T;
+};
```

**File**: `tests/services/mcpService-header-env-from-config.test.ts` (modified, +37/-2)
```diff
@@ -54,6 +54,9 @@ jest.mock('../../src/services/proxy.js', () => ({
 }));
 
 jest.mock('../../src/dao/index.js', () => ({
+  getUserDao: jest.fn(() => ({
+    findByUsername: jest.fn(async (username: string) => ({ isAdmin: username === 'admin' })),
+  })),
   getServerDao: jest.fn(() => ({
     findAll: jest.fn(async () => []),
     findById: jest.fn(async () => null),
@@ -84,6 +87,7 @@ jest.mock('@modelcontextprotocol/client', () => ({
 jest.mock('@modelcontextprotocol/client/stdio', () => ({
   StdioClientTransport: jest.fn(),
 }));
+import { expandServerConfig } from '../../src/services/serverConfigEnvironment.js';
 import { createTransportFromConfig } from '../../src/services/mcpService.js';
 
 describe('MCP Service - header env var expansion from server config', () => {
@@ -102,7 +106,7 @@ describe('MCP Service - header env var expansion from server config', () => {
   it('expands streamable-http header values using config env vars', async () => {
     await createTransportFromConfig('demo-streamable', {
       type: 'streamable-http',
-      url: 'https://example.com/mcp',
+      url: 'https://8.8.8.8/mcp',
       env: {
         AUTH_TOKEN: 'configured-token',
       },
@@ -121,7 +125,7 @@ describe('MCP Service - header env var expansion from server config', () => {
   it('expands sse header values using config env vars', async () => {
     await createTransportFromConfig('demo-sse', {
       type: 'sse',
-      url: 'https://example.com/sse',
+      url: 'https://8.8.8.8/sse',
       env: {
         AUTH_TOKEN: 'configured-token',
       },
@@ -139,4 +143,35 @@ describe('MCP Service - header env var expansion from server config', () => {
       Authorization: 'Bearer configured-token',
     });
   });
+  it.each(['streamable-http', 'sse'])('does not send hub secrets in %s headers', async (type) => {
+    process.env.HUB_SECRET = 'synthetic-hub-secret';
+    await createTransportFromConfig('untrusted', {
+      owner: 'member',
+      type: type as 'sse' | 'streamable-http',
+      url: 'https://8.8.8.8/mcp',
+      env: { COPIED: '${HUB_SECRET}', OWN: 'own-token' },
+      headers: { Leak: '${HUB_SECRET}', Indirect: '${COPIED}', Own: '${OWN}' },
+    });
+    const constructor = type === 'sse' ? SSEClientTransport : StreamableHTTPClientTransport;
+    const options = (constructor as jest.Mock).mock.calls[0][1];
+    expect(JSON.stringify(options.requestInit.headers)).not.toContain('synthetic-hub-secret');
+    expect(options.requestInit.headers.Own).toBe('own-token');
+  });
+  it.each(['streamable-http', 'sse'])(
+    'keeps literal owner privileges through %s expansion',
+    async (type) => {
+      process.env.HUB_SECRET = 'synthetic-hub-secret';
+      const expanded = await expandServerConfig({
+        owner: '${ROLE}',
+        type: type as 'sse' | 'streamable-http',
+        url: 'https://8.8.8.8/mcp',
+        env: { ROLE: 'admin', DOLLAR: '$' },
+        headers: { Leak: '${DOLLAR}{HUB_SECRET}' },
+      });
+      await createTransportFromConfig('literal-owner', expanded);
+      const constructor = type === 'sse' ? SSEClientTransport : StreamableHTTPClientTransport;
+      const options = (constructor as jest.Mock).mock.calls[0][1];
+      expect(JSON.stringify(options.requestInit.headers)).not.toContain('synthetic-hub-secret');
+    },
+  );
 });
```

**File**: `tests/services/principalRuntimeService.test.ts` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ const mockDefinition: ServerConfigWithName = {
 };
 let mockRevision = 'first';
 jest.mock('../../src/dao/DaoFactory.js', () => ({
+  getUserDao: () => ({ findByUsername: async () => ({ isAdmin: true }) }),
   getServerDao: () => ({ findById: async () => mockDefinition }),
 }));
 jest.mock('../../src/services/credentialBindingService.js', () => ({
```

**File**: `tests/services/serverConfigEnvironment.test.ts` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+import {
+  getServerEnvironment,
+  expandServerConfig,
+} from '../../src/services/serverConfigEnvironment.js';
+
+jest.mock('../../src/dao/index.js', () => ({
+  getUserDao: () => ({
+    findByUsername: async (username: string) =>
+      username === 'admin' ? { isAdmin: true } : username === 'member' ? { isAdmin: false } : null,
+  }),
+}));
+
+describe('server configuration environment boundary', () => {
+  const original = process.env;
+  beforeEach(() => {
+    process.env = { ...original, HUB_SECRET: 'synthetic-hub-secret' };
+  });
+  afterAll(() => {
+    process.env = original;
+  });
+
+  it.each(['member', 'deleted-user'])('does not expose process secrets for %s', async (owner) => {
+    const config = {
+      owner,
+      url: 'https://example.com/${HUB_SECRET}',
+      env: { COPIED: '${HUB_SECRET}', OWN: 'user-value' },
+      headers: { Leak: '${HUB_SECRET}', Indirect: '${COPIED}', Own: '${OWN}' },
+    };
+    const expanded = await expandServerConfig(config);
+    const env = await getServerEnvironment(config);
+    expect(JSON.stringify(expanded)).not.toContain('synthetic-hub-secret');
+    expect(env.HUB_SECRET).toBeUndefined();
+    expect(expanded.headers.Own).toBe('user-value');
+  });
+
+  it('preserves authorization fields as literal values', async () => {
+    const config = {
+      owner: '${ROLE}',
+      visibility: 'group' as const,
+      sharedWithUsers: ['${ROLE}'],
+      env: { ROLE: 'admin', DOLLAR: '$' },
+      headers: { Leak: '${DOLLAR}{HUB_SECRET}' },
+    };
+    const expanded = await expandServerConfig(config);
+    expect(expanded.owner).toBe(config.owner);
+    expect(expanded.visibility).toBe(config.visibility);
+    expect(expanded.sharedWithUsers).toEqual(config.sharedWithUsers);
+    expect((await getServerEnvironment(expanded)).HUB_SECRET).toBeUndefined();
+  });
+
+  it.each(['admin', undefined])('preserves trusted process expansion for %s', async (owner) => {
+    expect(
+      (await expandServerConfig({ owner, headers: { Secret: '${HUB_SECRET}' } })).headers.Secret,
+    ).toBe('synthetic-hub-secret');
+  });
+  it('keeps resolved personal credential values literal', async () => {
+    const env = await getServerEnvironment({
+      owner: 'admin',
+      credentialTemplate: [{ target: 'env', name: 'KEY' }],
+      env: { KEY: 'literal-${HUB_SECRET}' },
+    });
+    expect(env.KEY).toBe('literal-${HUB_SECRET}');
+  });
+});
```

---

### Incident Patch 7: `540d4345` (2026-10-03)
**Commit Message**: fix: preserve stdio argument boundaries in server editor (#1269)

**File**: `docs/features/per-user-credentials.mdx` (modified, +20/-0)
```diff
@@ -51,6 +51,26 @@ The environment variables follow the upstream [Tavily configuration](https://git
 
 For an HTTP server, declare `{"target":"headers","name":"Authorization"}` instead. Shared upstream OAuth cannot be combined with a personal credential template.
 
+## CLI-only credentials
+
+For a CLI that accepts credentials only as arguments, use a POSIX shell wrapper with a lowercase environment slot. Use `$my_api_key`, not `$MY_API_KEY` or `${my_api_key}`: MCPHub expands the latter forms against its own environment before injecting personal credentials. Keep the shell reference double-quoted so spaces and shell symbols in the credential remain literal. In the dashboard, add two argument fields: `-c` and the complete script below. Do not add quotes around the entire script field.
+
+```json
+{
+  "command": "sh",
+  "args": ["-c", "exec cli --api-key \"$my_api_key\""],
+  "credentialTemplate": [
+    {
+      "target": "env",
+      "name": "my_api_key",
+      "label": "API key"
+    }
+  ]
+}
+```
+
+Replace `cli` with your installed MCP server executable. This wrapper requires `sh`; native per-user OAuth and args credential slots are not currently supported. Validate through MCPHub with two user bindings, rather than only running the command in an interactive shell.
+
 ## Manage a binding through the API
 
 Use dashboard authentication (JWT in `x-auth-token`, an OIDC/session login, or a user OAuth access token). User-level MCP bearer keys remain MCP-only credentials; system bearer keys and anonymous dashboard mode cannot manage personal bindings. No endpoint accepts a target username.
```

**File**: `docs/zh/features/per-user-credentials.mdx` (modified, +20/-0)
```diff
@@ -51,6 +51,26 @@ stdio 使用 `env`；SSE、Streamable HTTP 和 OpenAPI 使用 `headers`。每个
 
 HTTP 服务器可声明 `{"target":"headers","name":"Authorization"}`。
 
+## 仅支持命令行参数的凭据
+
+如果 CLI 仅通过命令行参数接收凭据，可使用 POSIX shell 包装并声明小写环境变量字段。使用 `$my_api_key`，不要使用 `$MY_API_KEY` 或 `${my_api_key}`：后两种写法会在注入个人凭据前，按 MCPHub 自身的环境变量展开。对 shell 变量引用保留双引号，使凭据中的空格和 shell 符号按字面值传递。在控制台添加两个参数输入框，分别填写 `-c` 和下面的完整脚本；不要给整个脚本输入框的内容再加一层引号。
+
+```json
+{
+  "command": "sh",
+  "args": ["-c", "exec cli --api-key \"$my_api_key\""],
+  "credentialTemplate": [
+    {
+      "target": "env",
+      "name": "my_api_key",
+      "label": "API key"
+    }
+  ]
+}
+```
+
+将 `cli` 替换为已安装的 MCP 服务器可执行文件。此方案需要 `sh`；目前尚不支持原生个人 OAuth 和 args 凭据字段。请通过 MCPHub 使用两个用户的绑定验证，而不只是在交互式 shell 中手动执行命令。
+
 ## 管理 API
 
 使用仪表板 JWT（`x-auth-token`）、OIDC/session 登录或用户 OAuth access token。用户级 MCP bearer key 仅用于 MCP 调用；系统 bearer key 和免登录模式不能管理个人绑定。接口不接受目标用户名。
```

**File**: `frontend/src/components/ServerForm.tsx` (modified, +46/-27)
```diff
@@ -123,12 +123,7 @@ const ServerForm = ({
     description: (initialData && initialData.config && initialData.config.description) || '',
     url: (initialData && initialData.config && initialData.config.url) || '',
     command: (initialData && initialData.config && initialData.config.command) || '',
-    arguments:
-      initialData && initialData.config && initialData.config.args
-        ? Array.isArray(initialData.config.args)
-          ? initialData.config.args.join(' ')
-          : String(initialData.config.args)
-        : '',
+    arguments: '',
     args: (initialData && initialData.config && initialData.config.args) || [],
     type: getInitialServerType(), // Initialize the type field
     env: getInitialServerEnvVars(initialData),
@@ -363,12 +358,6 @@ const ServerForm = ({
     setFormData({ ...formData, [name]: value });
   };
 
-  // Transform space-separated arguments string into array
-  const handleArgsChange = (value: string) => {
-    const args = value.split(' ').filter((arg) => arg.trim() !== '');
-    setFormData({ ...formData, arguments: value, args });
-  };
-
   const updateServerType = (type: 'stdio' | 'sse' | 'streamable-http' | 'openapi') => {
     setServerType(type);
     setFormData((prev) => ({ ...prev, type }));
@@ -1640,21 +1629,51 @@ const ServerForm = ({
                   />
                 </div>
                 <div className="mb-4">
-                  <label
-                    className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
-                    htmlFor="arguments"
-                  >
-                    {t('server.arguments')}
-                  </label>
-                  <input
-                    type="text"
-                    name="arguments"
-                    id="arguments"
-                    value={formData.arguments}
-                    onChange={(e) => handleArgsChange(e.target.value)}
-                    className="w-full py-2 px-3 form-input"
-                    placeholder="e.g.: -y time-mcp"
-                  />
+                  <div className="flex justify-between items-center mb-2">
+                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
+                      {t('server.arguments')}
+                    </span>
+                    <button
+                      type="button"
+                      className="text-sm text-blue-600 dark:text-blue-400"
+                      onClick={() =>
+                        setFormData((prev) => ({ ...prev, args: [...(prev.args || []), ''] }))
+                      }
+                    >
+                      {t('server.addArgument')}
+                    </button>
+                  </div>
+                  <p className="text-xs text-gray-500 mb-2">{t('server.argumentsHint')}</p>
+                  {(formData.args || []).map((arg, index) => (
+                    <div key={index} className="flex items-center gap-2 mb-2">
+                      <input
+                        type="text"
+                        aria-label={t('server.argumentLabel', { index: index + 1 })}
+                        value={arg}
+                        onChange={(e) => {
+                          const value = e.target.value;
+                          setFormData((prev) => ({
+                            ...prev,
+                            args: prev.args?.map((item, i) => (i === index ? value : item)),
+                          }));
+                        }}
+                        className="w-full py-2 px-3 form-input"
+                      />
+                      <button
+                        type="button"
+                        aria-label={t('server.removeArgument', { index: index + 1 })}
+                        onClick={() =>
+                          setFormData((prev) => ({
+                            ...prev,
+                            args: prev.args?.filter((_, i) => i !== index),
+                          }))
+                        }
+                        className="text-gray-500 hover:text-red-600"
+                      >
+                        <X size={16} />
+                      </button>
+                    </div>
+                  ))}
                 </div>
 
                 <div className="mb-4">
```

**File**: `locales/en.json` (modified, +4/-0)
```diff
@@ -168,6 +168,10 @@
     "packageVersion": "Installed package version (last installed by the runner cache)",
     "updateAvailable": "A newer version is available on the registry",
     "arguments": "Arguments",
+    "addArgument": "Add argument",
+    "argumentsHint": "Each field is one argument. Spaces and quotes are preserved; an empty field passes an empty argument.",
+    "argumentLabel": "Argument {{index}}",
+    "removeArgument": "Remove argument {{index}}",
     "envVars": "Environment Variables",
     "headers": "HTTP Headers",
     "key": "key",
```

**File**: `locales/fr.json` (modified, +4/-0)
```diff
@@ -168,6 +168,10 @@
     "packageVersion": "Version du paquet installé (dernière installée dans le cache du runner)",
     "updateAvailable": "Une version plus récente est disponible sur le registre",
     "arguments": "Arguments",
+    "addArgument": "Ajouter un argument",
+    "argumentsHint": "Chaque champ correspond à un argument. Les espaces et guillemets sont conservés ; un champ vide transmet un argument vide.",
+    "argumentLabel": "Argument {{index}}",
+    "removeArgument": "Supprimer l’argument {{index}}",
     "envVars": "Variables d'environnement",
     "headers": "En-têtes HTTP",
     "key": "clé",
```

**File**: `locales/tr.json` (modified, +4/-0)
```diff
@@ -168,6 +168,10 @@
     "packageVersion": "Kurulu paket sürümü (runner önbelleğindeki son kurulum)",
     "updateAvailable": "Kayıt defterinde daha yeni bir sürüm mevcut",
     "arguments": "Argümanlar",
+    "addArgument": "Argüman ekle",
+    "argumentsHint": "Her alan bir argümandır. Boşluklar ve tırnaklar korunur; boş bir alan boş bir argüman iletir.",
+    "argumentLabel": "Argüman {{index}}",
+    "removeArgument": "Argüman {{index}} kaldır",
     "envVars": "Ortam Değişkenleri",
     "headers": "HTTP Başlıkları",
     "key": "anahtar",
```

**File**: `locales/zh.json` (modified, +4/-0)
```diff
@@ -168,6 +168,10 @@
     "packageVersion": "已安装的包版本（runner 缓存中最后安装的版本）",
     "updateAvailable": "源上有更新的版本可用",
     "arguments": "参数",
+    "addArgument": "添加参数",
+    "argumentsHint": "每个输入框对应一个参数，保留空格和引号；空输入框会传递空字符串参数。",
+    "argumentLabel": "参数 {{index}}",
+    "removeArgument": "移除参数 {{index}}",
     "envVars": "环境变量",
     "headers": "HTTP 请求头",
     "key": "键",
```

**File**: `tests/frontend/serverFormPayload.test.ts` (modified, +26/-0)
```diff
@@ -2,6 +2,32 @@ import type { ServerFormData } from '../../frontend/src/types';
 import { buildServerPayload } from '../../frontend/src/utils/serverFormPayload';
 
 describe('buildServerPayload', () => {
+  it('preserves stdio argument boundaries, empty values, and literal shell syntax', () => {
+    const args = [
+      '-c',
+      'exec cli --api-key "$my_api_key"',
+      '/path with spaces',
+      '',
+      '  padded  ',
+      'a"b\\c',
+    ];
+    const payload = buildServerPayload({
+      formData: {
+        name: 'wrapped',
+        url: '',
+        command: 'sh',
+        arguments: '',
+        args,
+        env: [],
+        headers: [],
+      },
+      serverType: 'stdio',
+      envVars: [],
+      headerVars: [],
+    });
+    expect(payload.config.args).toEqual(args);
+  });
+
   it('keeps empty headers and env payloads explicit for SSE servers', () => {
     const payload = buildServerPayload({
       formData: {
```

---

### Incident Patch 8: `079c5db3` (2026-10-02)
**Commit Message**: fix: improve dark-mode contrast for notices and upload states (#1265)

**File**: `frontend/src/components/AddServerForm.tsx` (modified, +3/-3)
```diff
@@ -177,18 +177,18 @@ const AddServerForm = ({
             <p className="text-gray-600 mb-4">
               {t('server.variablesDetected')}
             </p>
-            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
+            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/60 rounded p-3 mb-4">
               <div className="flex items-start">
                 <div className="flex-shrink-0">
                   <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                   </svg>
                 </div>
                 <div className="ml-3">
-                  <h4 className="text-sm font-medium text-yellow-800">
+                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                     {t('server.detectedVariables')}:
                   </h4>
-                  <ul className="mt-1 text-sm text-yellow-700">
+                  <ul className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                     {detectedVariables.map((variable, index) => (
                       <li key={index} className="font-mono">
                         ${`{${variable}}`}
```

**File**: `frontend/src/components/MarketServerDetail.tsx` (modified, +5/-5)
```diff
@@ -174,7 +174,7 @@ const MarketServerDetail: React.FC<MarketServerDetailProps> = ({
 
         <div className="flex items-center">
           {server.is_official && (
-            <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-sm font-normal px-4 py-2 rounded mr-2 flex items-center label-primary">
+            <span className="bg-blue-100 text-blue-800 dark:text-blue-300 dark:bg-blue-900/40 dark:text-blue-300 text-sm font-normal px-4 py-2 rounded mr-2 flex items-center label-primary">
               {t('market.official')}
             </span>
           )}
@@ -204,7 +204,7 @@ const MarketServerDetail: React.FC<MarketServerDetailProps> = ({
             server.tags.map((tag, index) => (
               <span
                 key={`tag-${index}`}
-                className="bg-gray-100 dark:bg-gray-800 text-green-700 px-2 py-1 rounded text-sm"
+                className="bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-300 px-2 py-1 rounded text-sm"
               >
                 #{tag}
               </span>
@@ -347,7 +347,7 @@ const MarketServerDetail: React.FC<MarketServerDetailProps> = ({
               {t('server.confirmVariables')}
             </h3>
             <p className="text-gray-600 mb-4">{t('server.variablesDetected')}</p>
-            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
+            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/60 rounded p-3 mb-4">
               <div className="flex items-start">
                 <div className="flex-shrink-0">
                   <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
@@ -359,10 +359,10 @@ const MarketServerDetail: React.FC<MarketServerDetailProps> = ({
                   </svg>
                 </div>
                 <div className="ml-3">
-                  <h4 className="text-sm font-medium text-yellow-800">
+                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                     {t('server.detectedVariables')}:
                   </h4>
-                  <ul className="mt-1 text-sm text-yellow-700">
+                  <ul className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                     {detectedVariables.map((variable, index) => (
                       <li key={index} className="font-mono">
                         ${`{${variable}}`}
```

**File**: `frontend/src/components/McpbUploadForm.tsx` (modified, +5/-5)
```diff
@@ -225,8 +225,8 @@ const McpbUploadForm: React.FC<McpbUploadFormProps> = ({ onSuccess, onCancel })
             </div>
 
             {error && (
-              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
-                <p className="text-red-700">{error}</p>
+              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
+                <p className="text-red-700 dark:text-red-300">{error}</p>
               </div>
             )}
 
@@ -344,16 +344,16 @@ const McpbUploadForm: React.FC<McpbUploadFormProps> = ({ onSuccess, onCancel })
         </div>
 
         {error && (
-          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
-            <p className="text-red-700">{error}</p>
+          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
+            <p className="text-red-700 dark:text-red-300">{error}</p>
           </div>
         )}
 
         {/* File Drop Zone */}
         <div
           className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
             isDragging
-              ? 'border-blue-500 bg-blue-50'
+              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
               : selectedFile
                 ? 'border-gray-500 '
                 : 'border-gray-300 hover:border-gray-400'
```

**File**: `frontend/src/components/TemplateExportForm.tsx` (modified, +5/-5)
```diff
@@ -82,8 +82,8 @@ const TemplateExportForm: React.FC<TemplateExportFormProps> = ({ groups, onCance
         </div>
 
         {error && (
-          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
-            <p className="text-red-700">{error}</p>
+          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
+            <p className="text-red-700 dark:text-red-300">{error}</p>
           </div>
         )}
 
@@ -121,7 +121,7 @@ const TemplateExportForm: React.FC<TemplateExportFormProps> = ({ groups, onCance
               </label>
               <button
                 onClick={handleSelectAll}
-                className="text-sm text-blue-600 hover:text-blue-800"
+                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300"
               >
                 {selectedGroupIds.length === groups.length
                   ? t('template.deselectAll')
@@ -163,8 +163,8 @@ const TemplateExportForm: React.FC<TemplateExportFormProps> = ({ groups, onCance
           </label>
         </div>
 
-        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
-          <p className="text-sm text-blue-700">{t('template.exportNote')}</p>
+        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/60 rounded-md">
+          <p className="text-sm text-blue-700 dark:text-blue-300">{t('template.exportNote')}</p>
         </div>
 
         <div className="flex justify-end space-x-4 mt-6">
```

**File**: `frontend/src/components/TemplateImportForm.tsx` (modified, +10/-10)
```diff
@@ -95,16 +95,16 @@ const TemplateImportForm: React.FC<TemplateImportFormProps> = ({ onSuccess, onCa
         </div>
 
         {error && (
-          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
-            <p className="text-red-700">{error}</p>
+          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
+            <p className="text-red-700 dark:text-red-300">{error}</p>
           </div>
         )}
 
         {result && (
           <div
-            className={`mb-4 p-4 rounded border-l-4 ${result.success ? 'bg-green-50 border-green-500' : 'bg-yellow-50 border-yellow-500'}`}
+            className={`mb-4 p-4 rounded border-l-4 ${result.success ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'}`}
           >
-            <p className={result.success ? 'text-green-700' : 'text-yellow-700'}>
+            <p className={result.success ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}>
               {t('template.importResult', {
                 serversCreated: result.serversCreated,
                 serversSkipped: result.serversSkipped,
@@ -113,11 +113,11 @@ const TemplateImportForm: React.FC<TemplateImportFormProps> = ({ onSuccess, onCa
               })}
             </p>
             {result.requiredEnvVars.length > 0 && (
-              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
-                <p className="text-sm font-medium text-orange-800">
+              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/60 rounded">
+                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                   {t('template.envVarsNeeded')}
                 </p>
-                <ul className="mt-1 text-sm text-orange-700">
+                <ul className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                   {result.requiredEnvVars.map((v) => (
                     <li key={v} className="font-mono">
                       {v}
@@ -228,11 +228,11 @@ const TemplateImportForm: React.FC<TemplateImportFormProps> = ({ onSuccess, onCa
               </div>
 
               {template.requiredEnvVars.length > 0 && (
-                <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
-                  <h4 className="text-sm font-medium text-orange-800">
+                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/60 rounded-md">
+                  <h4 className="text-sm font-medium text-orange-800 dark:text-orange-300">
                     {t('template.envVarsNeeded')}
                   </h4>
-                  <ul className="mt-1 text-sm text-orange-700 font-mono">
+                  <ul className="mt-1 text-sm text-orange-700 dark:text-orange-300 font-mono">
                     {template.requiredEnvVars.map((v) => (
                       <li key={v}>{v}</li>
                     ))}
```

**File**: `frontend/src/components/ui/PromptResult.tsx` (modified, +3/-3)
```diff
@@ -141,10 +141,10 @@ const PromptResult: React.FC<PromptResultProps> = ({ result, onClose }) => {
           <div>
             <div className="flex items-center space-x-2 mb-3">
               <AlertCircle size={16} className="text-red-500" />
-              <span className="text-sm font-medium text-red-700">{t('prompt.error')}</span>
+              <span className="text-sm font-medium text-red-700 dark:text-red-300">{t('prompt.error')}</span>
             </div>
-            <div className="bg-red-50 border border-red-300 rounded-md p-3">
-              <pre className="text-sm text-red-800 whitespace-pre-wrap">
+            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700/60 rounded-md p-3">
+              <pre className="text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap">
                 {result.error || result.message || t('prompt.unknownError')}
               </pre>
             </div>
```

**File**: `frontend/src/components/ui/Toast.tsx` (modified, +18/-9)
```diff
@@ -63,17 +63,24 @@ const Toast: React.FC<ToastProps> = ({
   };
 
   const bgColors = {
-    success: 'bg-green-50 border-green-200',
-    error: 'bg-red-50 border-red-200',
-    info: 'bg-blue-50 border-blue-200',
-    warning: 'bg-yellow-50 border-yellow-200',
+    success: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
+    error: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
+    info: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
+    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
   };
 
   const textColors = {
-    success: 'text-green-800',
-    error: 'text-red-800',
-    info: 'text-blue-800',
-    warning: 'text-yellow-800',
+    success: 'text-green-800 dark:text-green-200',
+    error: 'text-red-800 dark:text-red-200',
+    info: 'text-blue-800 dark:text-blue-200',
+    warning: 'text-yellow-800 dark:text-yellow-200',
+  };
+
+  const closeStyles = {
+    success: 'hover:bg-green-100 dark:hover:bg-green-900 focus:ring-green-500',
+    error: 'hover:bg-red-100 dark:hover:bg-red-900 focus:ring-red-500',
+    info: 'hover:bg-blue-100 dark:hover:bg-blue-900 focus:ring-blue-500',
+    warning: 'hover:bg-yellow-100 dark:hover:bg-yellow-900 focus:ring-yellow-500',
   };
 
   const accentBorders = {
@@ -88,6 +95,7 @@ const Toast: React.FC<ToastProps> = ({
       className={cn(
         'fixed top-4 right-4 z-50 max-w-sm p-4 rounded-md shadow-lg border',
         bgColors[type],
+        textColors[type],
         accentBorders[type],
         'transform transition-all duration-300 ease-in-out',
         visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
@@ -104,7 +112,8 @@ const Toast: React.FC<ToastProps> = ({
               onClick={onClose}
               className={cn(
                 'inline-flex rounded-md p-1.5',
-                `hover:bg-${type}-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${type}-500`,
+                'focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
+                closeStyles[type],
               )}
             >
               <span className="sr-only">{t('common.dismiss')}</span>
```

**File**: `frontend/src/components/ui/ToolResult.tsx` (modified, +3/-3)
```diff
@@ -274,16 +274,16 @@ const ToolResult: React.FC<ToolResultProps> = ({ result, onClose }) => {
           <div>
             <div className="flex items-center space-x-2 mb-3">
               <AlertCircle size={16} className="text-red-500" />
-              <span className="text-sm font-medium text-red-700">{t('tool.error')}</span>
+              <span className="text-sm font-medium text-red-700 dark:text-red-300">{t('tool.error')}</span>
             </div>
             {content && content.length > 0 ? (
               <div>
                 <div className="text-sm text-gray-600 mb-3">{t('tool.errorDetails')}</div>
                 {renderContent(content)}
               </div>
             ) : (
-              <div className="bg-red-50 border border-red-300 rounded-md p-3">
-                <pre className="text-sm text-red-800 whitespace-pre-wrap">
+              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700/60 rounded-md p-3">
+                <pre className="text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap">
                   {result.error || result.message || t('tool.unknownError')}
                 </pre>
               </div>
```

---

### Incident Patch 9: `d3f48167` (2026-10-02)
**Commit Message**: chore(deps-dev): upgrade @eslint/js and fix CI (#1261)

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: samanhappy <[REDACTED_EMAIL]>

**File**: `src/clients/openapi.ts` (modified, +2/-0)
```diff
@@ -519,6 +519,7 @@ export class OpenAPIClient {
       const errorMessage = error instanceof Error ? error.message : String(error);
       throw new Error(
         `Failed to load OpenAPI specification: ${sanitizeStringForLogging(errorMessage)}`,
+        { cause: error },
       );
     }
   }
@@ -1112,6 +1113,7 @@ export class OpenAPIClient {
         responseDetails = sanitizeStringForLogging(responseDetails);
         throw new Error(
           `API call failed: ${status} ${statusText}${responseDetails ? ` ${responseDetails}` : ''}`,
+          { cause: error },
         );
       }
       throw error;
```

**File**: `src/config/index.ts` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ export const loadOriginalSettings = (): McpSettings => {
     logger.log(`Loaded settings from ${settingsPath}`);
     return settings;
   } catch (error) {
-    throw new Error(`Failed to load settings from ${settingsPath}: ${error}`);
+    throw new Error(`Failed to load settings from ${settingsPath}: ${error}`, { cause: error });
   }
 };
 
```

**File**: `src/middlewares/auth.ts` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ export const auth = async (req: Request, res: Response, next: NextFunction): Pro
   };
 
   // Check if bearer auth via configured keys can validate this request
-  let matchingBearerKey: BearerKey | null = null;
+  let matchingBearerKey: BearerKey | null;
   try {
     matchingBearerKey = await validateBearerAuth(req, systemConfig);
   } catch (error) {
```

**File**: `src/services/mcpService.ts` (modified, +4/-2)
```diff
@@ -1773,7 +1773,9 @@ const callToolWithReconnect = async (
         try {
           const rawConfig = await getServerDao().findById(serverInfo.name);
           if (!rawConfig) {
-            throw new Error(`Server configuration not found for: ${serverInfo.name}`);
+            throw new Error(`Server configuration not found for: ${serverInfo.name}`, {
+              cause: error,
+            });
           }
 
           // Match initial connection expansion before URL validation and transport creation.
@@ -3910,7 +3912,7 @@ const handleCallToolRequestImpl = async (request: any, extra: any) => {
     extra?.username ||
     (requestContextService.getKeyKindContext() === 'system' ? 'system' : undefined) ||
     undefined;
-  let appsRouteContext: McpAppsRouteContext = { enabled: false };
+  let appsRouteContext: McpAppsRouteContext;
   const keyId = bearerKeyContext.keyId || extra?.keyId || undefined;
   const keyName = bearerKeyContext.keyName || extra?.keyName || undefined;
   const sourceIp = requestContextService.getRequestContext()?.remoteAddress || undefined;
```

**File**: `src/services/oauthClientRegistration.ts` (modified, +1/-0)
```diff
@@ -232,6 +232,7 @@ export const discoverIssuer = async (
     logger.error('Failed to discover OAuth issuer', { issuerUrl, error });
     throw new Error(
       `OAuth issuer discovery failed: ${error instanceof Error ? error.message : String(error)}`,
+      { cause: error },
     );
   }
 };
```

**File**: `src/services/proxy.ts` (modified, +1/-0)
```diff
@@ -102,6 +102,7 @@ export function createFetchWithProxy(
         'Proxy support requires the "undici" package. ' +
           'Install it with: npm install undici\n' +
           `Original error: ${error instanceof Error ? error.message : String(error)}`,
+        { cause: error },
       );
     }
   }) as FetchLike;
```

**File**: `src/services/vectorSearchService.ts` (modified, +3/-1)
```diff
@@ -1995,7 +1995,9 @@ async function checkDatabaseVectorDimensions(dimensionsNeeded: number): Promise<
     return false;
   } catch (error: any) {
     logger.error('Error checking or updating vector dimensions', { error });
-    throw new Error(`Vector dimension check failed: ${error?.message || 'Unknown error'}`);
+    throw new Error(`Vector dimension check failed: ${error?.message || 'Unknown error'}`, {
+      cause: error,
+    });
   }
 }
 
```

**File**: `src/utils/oauthConsentResource.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ export interface ResourceTarget {
  * - anything else -> `unknown`
  */
 export function parseResourceTarget(raw: string): ResourceTarget {
-  let pathname = '';
+  let pathname: string;
   try {
     pathname = new URL(raw).pathname;
   } catch {
```

---

### Incident Patch 10: `44b9abfe` (2026-10-02)
**Commit Message**: chore(deps-dev): bump @radix-ui/react-slot from 1.2.3 to 1.3.3 (#1253)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `pnpm-lock.yaml` (modified, +32/-1)
```diff
@@ -217,7 +217,7 @@ importers:
         version: 1.2.12(@types/react-dom@19.1.7(@types/react@19.2.16))(@types/react@19.2.16)(react-dom@19.2.7(react@19.2.7))(react@19.2.7)
       '@radix-ui/react-slot':
         specifier: ^1.2.3
-        version: 1.2.3(@types/react@19.2.16)(react@19.2.7)
+        version: 1.3.3(@types/react@19.2.16)(react@19.2.7)
       '@shadcn/ui':
         specifier: ^0.0.4
         version: 0.0.4
@@ -1349,6 +1349,15 @@ packages:
       '@types/react':
         optional: true
 
+  '@radix-ui/react-compose-refs@1.1.5':
+    resolution: {integrity: sha512-+48PbAAbq3didjJxa+OaWY2ZwgAKsNiRGyeHKszblZMQ+kcpd9pAaT11cMkGEie0vsOi3QdeTE6d5Fe3Gn61kA==}
+    peerDependencies:
+      '@types/react': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+
   '@radix-ui/react-context@1.1.2':
     resolution: {integrity: sha512-jCi/QKUM2r1Ju5a3J64TH2A5SpKAgh0LpknyqdQ4m6DCV0xJ2HG1xARRwNGPQfi1SLdLWZ1OJz6F4OMBBNiGJA==}
     peerDependencies:
@@ -1411,6 +1420,15 @@ packages:
       '@types/react':
         optional: true
 
+  '@radix-ui/react-slot@1.3.3':
+    resolution: {integrity: sha512-qx7oqnYbxnK9kYI9m317qmFmEgo6ywqWvbTogdj7cL9p3/yx4M48p7Rnw5z3H890cL/ow/EeWJsuTykeZVXP5Q==}
+    peerDependencies:
+      '@types/react': '*'
+      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
+
   '@radix-ui/react-use-controllable-state@1.2.2':
     resolution: {integrity: sha512-BjasUjixPFdS+NKkypcyyN5Pmg83Olst0+c6vGov0diwTEo6mgdqVR6hxcEgFuh4QrAs7Rc+9KuGJ9TVCj0Zzg==}
     peerDependencies:
@@ -6497,6 +6515,12 @@ snapshots:
     optionalDependencies:
       '@types/react': 19.2.16
 
+  '@radix-ui/react-compose-refs@1.1.5(@types/react@19.2.16)(react@19.2.7)':
+    dependencies:
+      react: 19.2.7
+    optionalDependencies:
+      '@types/react': 19.2.16
+
   '@radix-ui/react-context@1.1.2(@types/react@19.2.16)(react@19.2.7)':
     dependencies:
       react: 19.2.7
@@ -6542,6 +6566,13 @@ snapshots:
     optionalDependencies:
       '@types/react': 19.2.16
 
+  '@radix-ui/react-slot@1.3.3(@types/react@19.2.16)(react@19.2.7)':
+    dependencies:
+      '@radix-ui/react-compose-refs': 1.1.5(@types/react@19.2.16)(react@19.2.7)
+      react: 19.2.7
+    optionalDependencies:
+      '@types/react': 19.2.16
+
   '@radix-ui/react-use-controllable-state@1.2.2(@types/react@19.2.16)(react@19.2.7)':
     dependencies:
       '@radix-ui/react-use-effect-event': 0.0.2(@types/react@19.2.16)(react@19.2.7)
```

---

### Incident Patch 11: `70cf036c` (2026-10-01)
**Commit Message**: fix(openapi): apply path-level parameters to generated tools (#1252)

**File**: `src/clients/__tests__/openapi-input-schema.test.ts` (modified, +108/-0)
```diff
@@ -224,4 +224,112 @@ describe('OpenAPIClient - Input Schema Generation', () => {
       required: ['Authorization'],
     });
   });
+
+  test('applies path-level parameters to every operation under the path', async () => {
+    const config: ServerConfig = {
+      type: 'openapi',
+      openapi: {
+        schema: {
+          openapi: '3.0.0',
+          info: { title: 'Test API', version: '1.0.0' },
+          paths: {
+            '/users/{userId}': {
+              parameters: [
+                {
+                  name: 'userId',
+                  in: 'path',
+                  required: true,
+                  description: 'User id',
+                  schema: { type: 'string' },
+                },
+              ],
+              get: {
+                operationId: 'getUser',
+                responses: { '200': { description: 'Success' } },
+              },
+              delete: {
+                operationId: 'deleteUser',
+                parameters: [{ name: 'force', in: 'query', schema: { type: 'boolean' } }],
+                responses: { '204': { description: 'Deleted' } },
+              },
+            },
+          },
+        } as OpenAPIV3.Document,
+      },
+    };
+
+    const client = new OpenAPIClient(config);
+    await client.initialize();
+
+    const [getUser, deleteUser] = client.getTools();
+    expect(getUser.inputSchema).toEqual({
+      type: 'object',
+      properties: { userId: { type: 'string', description: 'User id' } },
+      required: ['userId'],
+    });
+    expect(deleteUser.inputSchema).toEqual({
+      type: 'object',
+      properties: {
+        userId: { type: 'string', description: 'User id' },
+        force: { type: 'boolean', description: 'Query parameter: force' },
+      },
+      required: ['userId'],
+    });
+
+    const request = jest.fn().mockResolvedValue({ data: { ok: true } });
+    (client as unknown as { httpClient: { request: jest.Mock } }).httpClient = { request };
+    await client.callTool('deleteUser', { userId: 'u/1', force: true });
+    expect(request.mock.calls[0][0]).toMatchObject({
+      method: 'delete',
+      url: '/users/u%2F1',
+      params: { force: true },
+    });
+  });
+
+  test('lets an operation parameter override a path-level one with the same name and location', async () => {
+    const config: ServerConfig = {
+      type: 'openapi',
+      openapi: {
+        schema: {
+          openapi: '3.0.0',
+          info: { title: 'Test API', version: '1.0.0' },
+          paths: {
+            '/reports': {
+              parameters: [
+                { name: 'format', in: 'query', description: 'Shared', schema: { type: 'string' } },
+                { name: 'X-Tenant-Id', in: 'header', schema: { type: 'string' } },
+              ],
+              get: {
+                operationId: 'listReports',
+                parameters: [
+                  {
+                    name: 'format',
+                    in: 'query',
+                    required: true,
+                    description: 'Report format',
+                    schema: { type: 'string', enum: ['csv', 'json'] },
+                  },
+                ],
+                responses: { '200': { description: 'Success' } },
+              },
+            },
+          },
+        } as OpenAPIV3.Document,
+      },
+    };
+
+    const client = new OpenAPIClient(config);
+    await client.initialize();
+
+    const tool = client.getTools()[0];
+    expect(tool.parameters).toHaveLength(2);
+    expect(tool.inputSchema).toEqual({
+      type: 'object',
+      properties: {
+        format: { type: 'string', enum: ['csv', 'json'], description: 'Report format' },
+        'X-Tenant-Id': { type: 'string', description: 'Header parameter: X-Tenant-Id' },
+      },
+      required: ['format'],
+    });
+  });
 });
```

**File**: `src/clients/openapi.ts` (modified, +22/-2)
```diff
@@ -67,6 +67,22 @@ function encodePathParameterValue(value: unknown): string {
   return encodeURIComponent(String(value));
 }
 
+// Path Item parameters apply to every operation under that path; an operation
+// parameter with the same name and location overrides the path-level one.
+function mergeOperationParameters(
+  pathLevel: OpenAPIV3.PathItemObject['parameters'],
+  operationLevel: OpenAPIV3.OperationObject['parameters'],
+): OpenAPIV3.ParameterObject[] | undefined {
+  if (!pathLevel?.length) {
+    return operationLevel as OpenAPIV3.ParameterObject[] | undefined;
+  }
+  const merged = new Map<string, OpenAPIV3.ParameterObject>();
+  for (const param of [...pathLevel, ...(operationLevel ?? [])] as OpenAPIV3.ParameterObject[]) {
+    merged.set(`${param.in}:${param.name}`, param);
+  }
+  return [...merged.values()];
+}
+
 function isPrintableAscii(value: string): boolean {
   return /^[\x20-\x7E]*$/.test(value);
 }
@@ -655,8 +671,12 @@ export class OpenAPIClient {
       ] as const;
 
       for (const method of methods) {
-        const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
-        if (!operation) continue;
+        const declaredOperation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
+        if (!declaredOperation) continue;
+        const operation: OpenAPIV3.OperationObject = {
+          ...declaredOperation,
+          parameters: mergeOperationParameters(pathItem.parameters, declaredOperation.parameters),
+        };
 
         // Generate operation name: use operationId first, otherwise generate unique name
         let operationName: string;
```

---

### Incident Patch 12: `9f5945b2` (2026-10-01)
**Commit Message**: fix: preserve full REST tool call results (#1251)

**File**: `docs/api-reference/tools.mdx` (modified, +2/-0)
```diff
@@ -57,6 +57,8 @@ Execute a specific tool on an MCP server with given arguments.
   }
   ```
 
+The response keeps the `success` / `data` envelope. `data` preserves the tool result fields, including `structuredContent`, `isError`, and `_meta` when present, alongside `toolName` and the converted `arguments`. Missing `content` defaults to `[]`. A tool execution failure is indicated by `data.isError: true`; the envelope's `success: true` means the API returned a tool result, not that the tool succeeded.
+
 **Example Request:**
 
 ```bash
```

**File**: `docs/zh/api-reference/tools.mdx` (modified, +2/-0)
```diff
@@ -55,6 +55,8 @@ import { Card, Cards } from 'mintlify';
   }
   ```
 
+响应保留 `success` / `data` 包装。`data` 保留工具结果中的字段，包括存在时的 `structuredContent`、`isError` 和 `_meta`，并附带 `toolName` 与类型转换后的 `arguments`。缺少 `content` 时默认返回 `[]`。工具执行失败由 `data.isError: true` 表示；外层的 `success: true` 表示 API 返回了工具结果，并不代表工具执行成功。
+
 **请求示例：**
 
 ```bash
```

**File**: `src/controllers/toolController.ts` (modified, +2/-1)
```diff
@@ -90,7 +90,8 @@ export const callTool = async (req: Request, res: Response): Promise<void> => {
     const response: ApiResponse = {
       success: true,
       data: {
-        content: result.content || [],
+        ...result,
+        content: result.content ?? [],
         toolName,
         arguments: convertedArgs,
       },
```

**File**: `tests/controllers/toolController.test.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import type { Request, Response } from 'express';
+
+jest.mock('../../src/services/mcpService.js', () => ({
+  handleCallToolRequest: jest.fn(),
+  getServerByName: jest.fn(),
+}));
+jest.mock('../../src/config/index.js', () => ({ getNameSeparator: () => '-' }));
+
+import { callTool } from '../../src/controllers/toolController.js';
+import { handleCallToolRequest } from '../../src/services/mcpService.js';
+
+describe('REST tool result forwarding (issue #1250)', () => {
+  it.each([
+    {
+      content: [{ type: 'text', text: 'Found 1 connector' }],
+      structuredContent: { connectors: [{ id: 'gmail' }] },
+      _meta: { source: 'upstream' },
+    },
+    { content: [{ type: 'text', text: 'Tool failed' }], isError: true },
+    { content: [], isError: false },
+    { content: [{ type: 'text', text: 'Legacy result' }] },
+    { structuredContent: { value: 42 } },
+  ])('preserves upstream result %j in the existing envelope', async (result) => {
+    jest.mocked(handleCallToolRequest).mockResolvedValue(result);
+    const req = {
+      params: { server: 'example' },
+      body: { toolName: 'lookup', arguments: { query: 'test' } },
+      headers: {},
+    } as unknown as Request;
+    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;
+
+    await callTool(req, res);
+
+    expect(res.json).toHaveBeenCalledWith({
+      success: true,
+      data: {
+        ...result,
+        content: result.content ?? [],
+        toolName: 'lookup',
+        arguments: { query: 'test' },
+      },
+    });
+    expect(res.status).not.toHaveBeenCalled();
+  });
+});
```

---

### Incident Patch 13: `c9df5956` (2026-09-30)
**Commit Message**: fix(oauth): restore discovery state for authorization callbacks (#1249)

**File**: `src/controllers/oauthCallbackController.ts` (modified, +1/-1)
```diff
@@ -371,7 +371,7 @@ export const handleOAuthCallback = async (req: Request, res: Response) => {
       try {
         logger.log('Calling transport.finishAuth for server', { serverName: serverInfo.name });
         const currentTransport = serverInfo.transport as any;
-        await currentTransport.finishAuth(codeParam);
+        await currentTransport.finishAuth(codeParam, issParam);
 
         // The state has served its purpose: the code was exchanged and the
         // server now holds the resulting tokens. Mark it consumed so a replayed
```

**File**: `src/services/mcpOAuthProvider.ts` (modified, +35/-2)
```diff
@@ -63,6 +63,7 @@ type OAuthClientInformationWithAuthMethod = OAuthClientInformation &
 export class MCPHubOAuthProvider implements OAuthClientProvider {
   private serverName: string;
   private serverConfig: ServerConfig;
+  private _discoveryState?: OAuthDiscoveryState;
   private _issuer?: string;
   private _issRequired?: boolean;
   private _codeVerifier?: string;
@@ -327,6 +328,9 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
 
     this._codeVerifier = undefined;
     this._currentState = undefined;
+    this._discoveryState = undefined;
+    this._issuer = undefined;
+    this._issRequired = undefined;
 
     const serverInfo = getServerByName(this.serverName);
     if (serverInfo) {
@@ -339,6 +343,7 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
   // Capture the SDK's actual discovery result before redirecting. Keep this
   // snapshot with the pending flow so callback validation survives restarts.
   saveDiscoveryState(state: OAuthDiscoveryState): void {
+    this._discoveryState = state;
     const metadata = state.authorizationServerMetadata;
     this._issuer = metadata?.issuer;
     this._issRequired = Boolean(
@@ -348,6 +353,18 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
     );
   }
 
+  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
+    if (this._discoveryState) return this._discoveryState;
+
+    const storedConfig = await loadServerConfig(this.serverName);
+    const state = storedConfig?.oauth?.pendingAuthorization?.discoveryState;
+    if (state && storedConfig) {
+      this.serverConfig = storedConfig;
+      this.saveDiscoveryState(state);
+    }
+    return state;
+  }
+
   /**
    * Redirect to authorization URL
    * In a server environment, we can't directly redirect the user
@@ -372,6 +389,7 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
     try {
       const pendingUpdate: Partial<NonNullable<ServerConfig['oauth']>['pendingAuthorization']> = {
         authorizationUrl,
+        discoveryState: this._discoveryState,
         issuer: this._issuer ?? this.serverConfig.oauth?.dynamicRegistration?.issuer,
         issRequired: this._issRequired,
         state,
@@ -390,6 +408,7 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
         serverName: this.serverName,
         error,
       });
+      throw error;
     }
 
     // Store the authorization URL in ServerInfo for the frontend to access
@@ -474,7 +493,14 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
    * Invalidate cached OAuth credentials when the SDK detects they are no longer valid.
    * This keeps stored configuration in sync and forces a fresh authorization flow.
    */
-  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): Promise<void> {
+  async invalidateCredentials(
+    scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
+  ): Promise<void> {
+    if (scope === 'discovery' || scope === 'verifier' || scope === 'all') {
+      this._discoveryState = undefined;
+      this._issuer = undefined;
+      this._issRequired = undefined;
+    }
     const storedConfig = await loadServerConfig(this.serverName);
 
     if (!storedConfig?.oauth) {
@@ -521,6 +547,10 @@ export class MCPHubOAuthProvider implements OAuthClientProvider {
       }
     }
 
+    if (scope === 'discovery' && currentConfig.oauth.pendingAuthorization) {
+      assignUpdatedConfig(await clearOAuthData(this.serverName, 'discovery'));
+    }
+
     if (scope === 'verifier' || scope === 'all') {
       this._codeVerifier = undefined;
       this._currentState = undefined;
@@ -557,7 +587,10 @@ const prepopulateScopesIfMissing = async (
   }
 
   try {
-    const scopes = await fetchScopesFromServer(serverConfig.url, await createOAuthFetch(serverConfig));
+    const scopes = await fetchScopesFromServer(
+      serverConfig.url,
+      await createOAuthFetch(serverConfig),
+    );
     // `scopes !== undefined`: persist and honor an explicitly empty result too (see #1227).
     if (scopes !== undefined) {
       // Update the in-memory config first: if the DAO write below throws, this connection
```

**File**: `src/services/oauthSettingsStore.ts` (modified, +7/-1)
```diff
@@ -154,7 +154,7 @@ export const updatePendingAuthorization = async (
  */
 export const clearOAuthData = async (
   serverName: string,
-  scope: 'all' | 'client' | 'tokens' | 'verifier',
+  scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
 ): Promise<ServerConfigWithOAuth | undefined> => {
   return mutateOAuthSettings(serverName, ({ oauth }) => {
     if (scope === 'tokens' || scope === 'all') {
@@ -167,6 +167,12 @@ export const clearOAuthData = async (
       delete oauth.clientSecret;
     }
 
+    if (scope === 'discovery' && oauth.pendingAuthorization) {
+      delete oauth.pendingAuthorization.discoveryState;
+      delete oauth.pendingAuthorization.issuer;
+      delete oauth.pendingAuthorization.issRequired;
+    }
+
     if (scope === 'verifier' || scope === 'all') {
       if (oauth.pendingAuthorization) {
         delete oauth.pendingAuthorization;
```

**File**: `src/types/index.ts` (modified, +2/-0)
```diff
@@ -4,6 +4,7 @@ import {
   SSEClientTransport,
   StreamableHTTPClientTransport,
   RequestOptions,
+  type OAuthDiscoveryState,
 } from '@modelcontextprotocol/client';
 import { SmartRoutingConfig } from '../utils/smartRouting.js';
 
@@ -505,6 +506,7 @@ export interface ServerConfig {
       issRequired?: boolean;
       state?: string;
       codeVerifier?: string;
+      discoveryState?: OAuthDiscoveryState;
       createdAt?: number;
     };
   };
```

**File**: `tests/controllers/oauthCallbackController.test.ts` (modified, +3/-3)
```diff
@@ -126,7 +126,7 @@ describe('oauthCallbackController iss validation', () => {
     );
 
     expect(res.statusCode).toBe(200);
-    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code');
+    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code', 'https://as.example.com');
   });
 
   it('rejects a mismatched iss without redeeming the code', async () => {
@@ -170,7 +170,7 @@ describe('oauthCallbackController iss validation', () => {
     );
 
     expect(res.statusCode).toBe(200);
-    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code');
+    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code', undefined);
   });
 
   it('reconnects a previously initialized client with the refreshed transport', async () => {
@@ -362,7 +362,7 @@ describe('oauthCallbackController iss validation', () => {
     );
 
     expect(res.statusCode).toBe(200);
-    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code');
+    expect(originalFinishAuth).toHaveBeenCalledWith('auth-code', 'https://as.example.com');
   });
 
   it('rejects a replayed state after the authorization completed', async () => {
```

**File**: `tests/integration/oauth-callback-reconnect.test.ts` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ describe('OAuth callback reconnect integration', () => {
         expect(finishAuth).not.toHaveBeenCalled();
         return;
       }
-      expect(finishAuth).toHaveBeenCalledWith('auth-code');
+      expect(finishAuth).toHaveBeenCalledWith('auth-code', iss);
       expect(connectClientWithDiagnostics).toHaveBeenCalledWith(
         serverInfo.client,
         refreshedTransport,
```

**File**: `tests/integration/oauth-discovery-state.test.ts` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+import { auth, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
+import { MCPHubOAuthProvider } from '../../src/services/mcpOAuthProvider.js';
+import { getServerDao } from '../../src/dao/index.js';
+import type { ServerConfig } from '../../src/types/index.js';
+
+jest.mock('../../src/dao/index.js', () => ({ getServerDao: jest.fn() }));
+jest.mock('../../src/services/mcpService.js', () => ({ getServerByName: jest.fn() }));
+jest.mock('../../src/services/oauthClientRegistration.js', () => ({
+  getRegisteredClient: jest.fn(),
+  removeRegisteredClient: jest.fn(),
+}));
+
+const issuer = 'https://as.example.com';
+const serverUrl = 'https://mcp.example.com/mcp';
+let stored: ServerConfig;
+let tokenCalls: number;
+let issRequired: boolean;
+let tokenBody: URLSearchParams;
+const fetchFn: typeof fetch = async (input, init) => {
+  const url = String(input);
+  if (url === `${issuer}/token`) {
+    tokenCalls++;
+    tokenBody = new URLSearchParams(String(init?.body));
+    return Response.json({ access_token: 'access-token', token_type: 'Bearer' });
+  }
+  if (url.includes('oauth-protected-resource')) {
+    return Response.json({ resource: serverUrl, authorization_servers: [issuer] });
+  }
+  return Response.json({
+    issuer,
+    authorization_endpoint: `${issuer}/authorize`,
+    token_endpoint: `${issuer}/token`,
+    response_types_supported: ['code'],
+    code_challenge_methods_supported: ['S256'],
+    authorization_response_iss_parameter_supported: issRequired,
+  });
+};
+const createProvider = () => new MCPHubOAuthProvider('upstream', structuredClone(stored));
+const start = async (provider: MCPHubOAuthProvider) => {
+  await expect(auth(provider, { serverUrl, fetchFn })).rejects.toThrow(
+    'OAuth authorization required',
+  );
+};
+const finish = (provider: MCPHubOAuthProvider, iss?: string) =>
+  new StreamableHTTPClientTransport(new URL(serverUrl), {
+    authProvider: provider,
+    fetch: fetchFn,
+  }).finishAuth('authorization-code', iss);
+
+beforeEach(() => {
+  tokenCalls = 0;
+  issRequired = false;
+  tokenBody = new URLSearchParams();
+  stored = {
+    url: serverUrl,
+    oauth: {
+      clientId: 'client-id',
+      scopes: [],
+      redirectUri: 'https://hub.example.com/oauth/callback',
+    },
+  };
+  jest.mocked(getServerDao).mockReturnValue({
+    findById: jest.fn(async () => ({ name: 'upstream', ...structuredClone(stored) })),
+    update: jest.fn(async (_name, updates) => {
+      stored = structuredClone({ ...stored, ...updates });
+      return { name: 'upstream', ...structuredClone(stored) };
+    }),
+  } as unknown as ReturnType<typeof getServerDao>);
+});
+
+it.each([false, true])(
+  'completes SDK authorization with recreated provider=%s',
+  async (restart) => {
+    const provider = createProvider();
+    await start(provider);
+    const verifier = stored.oauth?.pendingAuthorization?.codeVerifier;
+    expect(stored.oauth?.pendingAuthorization?.discoveryState?.authorizationServerUrl).toBe(issuer);
+    const callbackProvider = restart ? createProvider() : provider;
+    await finish(callbackProvider);
+    expect(tokenCalls).toBe(1);
+    expect(tokenBody.get('code_verifier')).toBe(verifier);
+    expect(tokenBody.get('code')).toBe('authorization-code');
+    expect(stored.oauth?.accessToken).toBe('access-token');
+    expect(stored.oauth?.pendingAuthorization).toBeUndefined();
+  },
+);
+
+it('passes the advertised issuer through the SDK callback', async () => {
+  issRequired = true;
+  await start(createProvider());
+  await finish(createProvider(), issuer);
+  expect(tokenCalls).toBe(1);
+});
+
+it('rejects a legacy pending flow without discovery state before token exchange', async () => {
+  await start(createProvider());
+  // Simulate a pending flow persisted by a pre-fix installation.
+  const pending = stored.oauth!.pendingAuthorization!;
+  Reflect.deleteProperty(pending, 'discoveryState');
+  await expect(finish(createProvider())).rejects.toThrow('discoveryState was not available');
+  expect(tokenCalls).toBe(0);
+});
+
+it.each(['discovery', 'verifier', 'all'] as const)(
+  'clears cached and persisted discovery on %s invalidation',
+  async (scope) => {
+    const provider = createProvider();
+    await start(provider);
+    expect(await provider.discoveryState()).toBeDefined();
+    await provider.invalidateCredentials(scope);
+    expect(await provider.discoveryState()).toBeUndefined();
+    expect(await createProvider().discoveryState()).toBeUndefined();
+    if (scope === 'discovery') {
+      expect(stored.oauth?.pendingAuthorization?.codeVerifier).toBeDefined();
+    } else {
+      expect(stored.oauth?.pendingAuthorization).toBeUndefined();
+    }
+  },
+);
+
+it('clears in-memory discovery after token exchange and permits a fresh flow', async () => {
+  const provider = createProvider();
+  await start(provider);
+  await finish(provider);
+  expect(await provider.discoveryState()).toBeUndefined();
```

---

### Incident Patch 14: `bb6b794e` (2026-09-30)
**Commit Message**: fix(servers): move prefixed tool and prompt toggles to the new name when a server is renamed (#1240)

**File**: `src/controllers/serverController.ts` (modified, +89/-0)
```diff
@@ -35,6 +35,7 @@ import {
   syncAllServerToolsEmbeddings,
 } from '../services/vectorSearchService.js';
 import { createSafeJSON } from '../utils/serialization.js';
+import { getNameSeparator } from '../config/index.js';
 import { cloneDefaultOAuthServerConfig } from '../constants/oauthServerDefaults.js';
 import {
   getBearerKeyDao,
@@ -943,6 +944,69 @@ export const deleteServer = async (req: Request, res: Response): Promise<void> =
   }
 };
 
+/**
+ * Move the keys of a server's `tools` or `prompts` map from the old name's
+ * prefix to the new one. The dashboard stores toggles and description
+ * overrides under the prefixed item name (`<server><separator><item>`), so
+ * after a rename the old keys match nothing: a tool disabled under them comes
+ * back enabled and callable, and its description override is lost. Keys
+ * without the old prefix are left as they are; if both prefixes are present,
+ * the old one wins, since it is the one that was in effect.
+ *
+ * With the default `-` separator a key such as `notes-delete_note` can also be
+ * the bare name of an upstream tool called `notes-delete_note`, which tool
+ * toggles accept as well. `keepOldKey` says which old-prefix keys to keep next
+ * to their moved copy, so that meaning survives the rename too.
+ */
+const movePrefixedItemKeys = <T>(
+  entries: Record<string, T> | undefined,
+  oldName: string,
+  newName: string,
+  keepOldKey: (key: string) => boolean = () => false,
+): Record<string, T> | undefined => {
+  if (!entries) {
+    return entries;
+  }
+
+  const separator = getNameSeparator();
+  const oldPrefix = `${oldName}${separator}`;
+  const newPrefix = `${newName}${separator}`;
+  const moved = Object.fromEntries(
+    Object.entries(entries).filter(([key]) => !key.startsWith(oldPrefix)),
+  ) as Record<string, T>;
+  for (const [key, value] of Object.entries(entries)) {
+    if (key.startsWith(oldPrefix)) {
+      moved[`${newPrefix}${key.substring(oldPrefix.length)}`] = value;
+      if (keepOldKey(key)) {
+        moved[key] = value;
+      }
+    }
+  }
+  return moved;
+};
+
+/**
+ * Whether an old-prefix `tools` key may be a bare upstream tool name. Tool
+ * toggles accept the bare name as well as the prefixed one, so `notes-x` on
+ * server `notes` applies both to tool `x` and to a tool literally named
+ * `notes-x`. The cached tool list says which bare names exist; without one
+ * (server not connected yet) every such key is kept, which is harmless when
+ * no such tool exists.
+ */
+const bareToolNameCheck = (serverName: string): ((key: string) => boolean) => {
+  const prefix = `${serverName}${getNameSeparator()}`;
+  const cachedTools = getServerByName(serverName)?.tools ?? [];
+  if (cachedTools.length === 0) {
+    return () => true;
+  }
+  const bareNames = new Set(
+    cachedTools.map((tool) =>
+      tool.name.startsWith(prefix) ? tool.name.substring(prefix.length) : tool.name,
+    ),
+  );
+  return (key) => bareNames.has(key);
+};
+
 export const updateServer = async (req: Request, res: Response): Promise<void> => {
   try {
     const { name } = req.params;
@@ -1084,6 +1148,9 @@ export const updateServer = async (req: Request, res: Response): Promise<void> =
         return;
       }
 
+      // Read the cached tool list before the runtime under the old name is closed
+      const isBareToolName = bareToolNameCheck(name);
+
       // Rename the server
       const renamed = await serverDao.rename(name, targetName);
       if (!renamed) {
@@ -1110,6 +1177,28 @@ export const updateServer = async (req: Request, res: Response): Promise<void> =
       const bearerKeyDao = getBearerKeyDao();
       await bearerKeyDao.updateServerName(name, targetName);
 
+      // Move tool and prompt toggles to the new prefix. A request without the
+      // map would keep the stored one through the update merge, old keys and
+      // all, so the stored map is moved in that case. Prompt lookups use the
+      // prefixed name only, so prompt keys are always moved.
+      const tools = movePrefixedItemKeys(
+        normalizedConfig.tools ?? existingServer.tools,
+        name,
+        targetName,
+        isBareToolName,
+      );
+      if (tools) {
+        normalizedConfig.tools = tools;
+      }
+      const prompts = movePrefixedItemKeys(
+        normalizedConfig.prompts ?? existingServer.prompts,
+        name,
+        targetName,
+      );
+      if (prompts) {
+        normalizedConfig.prompts = prompts;
+      }
+
       // Drop embeddings stored under the old name so search_tools does not
       // advertise phantom tools; addOrUpdateServer below regenerates them
       // under the new name. A credential server never connects globally, so
```

**File**: `tests/controllers/serverController.test.ts` (modified, +126/-0)
```diff
@@ -103,6 +103,12 @@ jest.mock('../../src/services/vectorSearchService.js', () => ({
   ),
 }));
 
+// Tool and prompt toggles are keyed by `<server><separator><item>`; pin the separator
+jest.mock('../../src/config/index.js', () => ({
+  ...(jest.requireActual('../../src/config/index.js') as object),
+  getNameSeparator: jest.fn(() => '::'),
+}));
+
 jest.mock('../../src/services/userContextService.js', () => ({
   UserContextService: {
     getInstance: jest.fn(() => ({
@@ -1725,13 +1731,24 @@ describe('serverController - updateServer', () => {
       mockBearerKeyDao.updateServerName.mockResolvedValue(undefined);
       mockAddOrUpdateServer.mockResolvedValue({ success: true });
       mockRemoveServerToolEmbeddings.mockResolvedValue(undefined);
+      // The runtime's cached tool list, named `<server><separator><upstream name>`
+      mockGetServerByName.mockReturnValue({
+        name: 'test-server',
+        tools: ['delete_note', 'list_notes', 'search_notes'].map((tool) => ({
+          name: `test-server::${tool}`,
+        })),
+      });
 
       mockRequest.body = {
         ...mockRequest.body,
         newName: 'renamed-server',
       };
     });
 
+    afterEach(() => {
+      mockGetServerByName.mockReset();
+    });
+
     it('updates every reference to the old name, including vector embeddings', async () => {
       await updateServer(mockRequest as Request, mockResponse as Response);
 
@@ -1756,6 +1773,115 @@ describe('serverController - updateServer', () => {
       });
     });
 
+    it('moves prefixed tool and prompt toggles to the new name', async () => {
+      mockRequest.body.config = {
+        ...mockRequest.body.config,
+        tools: {
+          'test-server::delete_note': { enabled: false },
+          'test-server::list_notes': { enabled: true, description: 'Custom description' },
+          // Bare keys do not depend on the server name
+          search_notes: { enabled: false },
+        },
+        prompts: { 'test-server::summarize': { enabled: false } },
+      };
+
+      await updateServer(mockRequest as Request, mockResponse as Response);
+
+      const [, savedConfig] = mockAddOrUpdateServer.mock.calls[0] as [string, any, boolean];
+      expect(savedConfig.tools).toEqual({
+        'renamed-server::delete_note': { enabled: false },
+        'renamed-server::list_notes': { enabled: true, description: 'Custom description' },
+        search_notes: { enabled: false },
+      });
+      expect(savedConfig.prompts).toEqual({ 'renamed-server::summarize': { enabled: false } });
+    });
+
+    it('moves the stored toggles when the request does not send them', async () => {
+      // Without them the update merge would keep the stored map, old keys and all
+      mockServerDao.findById.mockResolvedValue({
+        name: 'test-server',
+        type: 'sse',
+        url: 'https://example.com/sse',
+        enabled: true,
+        owner: 'admin',
+        visibility: 'private',
+        tools: { 'test-server::delete_note': { enabled: false } },
+        prompts: { 'test-server::summarize': { enabled: false } },
+      });
+
+      await updateServer(mockRequest as Request, mockResponse as Response);
+
+      const [, savedConfig] = mockAddOrUpdateServer.mock.calls[0] as [string, any, boolean];
+      expect(savedConfig.tools).toEqual({ 'renamed-server::delete_note': { enabled: false } });
+      expect(savedConfig.prompts).toEqual({ 'renamed-server::summarize': { enabled: false } });
+    });
+
+    it('keeps the toggle that was in effect when both prefixes are present', async () => {
+      mockRequest.body.config = {
+        ...mockRequest.body.config,
+        tools: {
+          // Left over from an earlier server of that name; it never matched anything
+          'renamed-server::delete_note': { enabled: true },
+          'test-server::delete_note': { enabled: false },
+        },
+      };
+
+      await updateServer(mockRequest as Request, mockResponse as Response);
+
+      const [, savedConfig] = mockAddOrUpdateServer.mock.calls[0] as [string, any, boolean];
+      expect(savedConfig.tools).toEqual({ 'renamed-server::delete_note': { enabled: false } });
+    });
+
+    it('keeps a bare key that is itself an upstream tool name starting with the server prefix', async () => {
+      // An upstream tool literally named 'test-server::delete_note' is cached as
+      // 'test-server::test-server::delete_note'; its bare toggle must survive
+      mockGetServerByName.mockReturnValue({
+        name: 'test-server',
+        tools: [{ name: 'test-server::test-server::delete_note' }],
+      });
+      mockRequest.body.config = {
+        ...mockRequest.body.config,
+        tools: { 'test-server::delete_note': { enabled: false } },
+      };
+
+      await updateServer(mockRequest as Request, mockResponse as Response);
+
+      const [, savedConfig] = mockAddOrUpdateServer.mock.calls[0] as [string, any, boolean];
+      expect(savedConfig.tools).toEqual({
+        // the 
```

---

### Incident Patch 15: `93ba5116` (2026-09-30)
**Commit Message**: fix(smart-routing): index credential servers on every per-user connect, mask their disabled tools and keep reindex and connect on the same sync (#1237)

**File**: `src/controllers/serverController.ts` (modified, +4/-1)
```diff
@@ -1112,7 +1112,10 @@ export const updateServer = async (req: Request, res: Response): Promise<void> =
 
       // Drop embeddings stored under the old name so search_tools does not
       // advertise phantom tools; addOrUpdateServer below regenerates them
-      // under the new name. A failure here must not abort the rename.
+      // under the new name. A credential server never connects globally, so
+      // its rows come back on the first per-user connect after a user binds
+      // credentials again (the bindings were dropped above), or on a reindex.
+      // A failure here must not abort the rename.
       try {
         await removeServerToolEmbeddings(name);
       } catch (error) {
```

**File**: `src/controllers/smartRoutingController.ts` (modified, +19/-5)
```diff
@@ -11,8 +11,12 @@ import {
   initializeDatabase,
   isDatabaseConnected,
 } from '../db/connection.js';
-import { saveToolsAsVectorEmbeddings } from '../services/vectorSearchService.js';
-import { getServerToolsForPrincipal, getServersInfo } from '../services/mcpService.js';
+import {
+  getServerToolsForPrincipal,
+  getServersInfo,
+  syncCredentialServerToolEmbeddings,
+  syncToolsAsVectorEmbeddings,
+} from '../services/mcpService.js';
 
 /**
  * Resolve the effective embedding model that the vector store is (or will be)
@@ -444,12 +448,22 @@ export const reindexSmartRouting = async (
       }
 
       try {
-        await saveToolsAsVectorEmbeddings(server.name, tools, { reportProgress: true });
+        // The same sync a connect runs, so the rows written here (description
+        // overrides, and for credential servers the disabled-tool mask) are the
+        // ones the next connect expects and skips.
+        let toolCount = tools.length;
+        if (hasCredentialTemplate(server.config)) {
+          toolCount = await syncCredentialServerToolEmbeddings(server.name, tools, {
+            reportProgress: true,
+          });
+        } else {
+          await syncToolsAsVectorEmbeddings(server.name, tools, { reportProgress: true });
+        }
         syncedServers += 1;
-        totalTools += tools.length;
+        totalTools += toolCount;
         results.push({
           serverName: server.name,
-          toolCount: tools.length,
+          toolCount,
           ok: true,
           ...(principals ? { principals } : {}),
         });
```

**File**: `src/db/repositories/VectorEmbeddingRepository.ts` (modified, +28/-5)
```diff
@@ -300,21 +300,22 @@ export class VectorEmbeddingRepository extends BaseRepository<VectorEmbedding> {
   async getToolIdentityByServerNameAndModel(
     serverName: string,
     model: string,
-  ): Promise<Array<{ contentId: string; toolSetHash?: string }>> {
+  ): Promise<Array<{ contentId: string; toolSetHash?: string; textContent?: string }>> {
     // Use raw SQL to bypass TypeORM's entity mapping for pgvector columns.
     // TypeORM's QueryBuilder with getMany() and .andWhere('ve.embedding IS NOT NULL')
     // on a vector-type column may silently return 0 rows due to type-mapping issues.
     const prefix = `${escapeLikePattern(serverName)}:%`;
 
-    const rows: Array<{ content_id: string; metadata: unknown }> = await getAppDataSource().query(
-      `SELECT content_id, metadata
+    const rows: Array<{ content_id: string; metadata: unknown; text_content: string | null }> =
+      await getAppDataSource().query(
+        `SELECT content_id, metadata, text_content
        FROM vector_embeddings
        WHERE content_type = $1
          AND content_id LIKE $2 ESCAPE '\\'
          AND model = $3
          AND embedding IS NOT NULL`,
-      ['tool', prefix, model],
-    );
+        ['tool', prefix, model],
+      );
 
     return rows.map((row) => {
       const rawMeta = row.metadata;
@@ -333,6 +334,7 @@ export class VectorEmbeddingRepository extends BaseRepository<VectorEmbedding> {
       return {
         contentId: row.content_id,
         toolSetHash: meta?.toolSetHash?.toString(),
+        textContent: row.text_content ?? undefined,
       };
     });
   }
@@ -370,6 +372,27 @@ export class VectorEmbeddingRepository extends BaseRepository<VectorEmbedding> {
     }
   }
 
+  /**
+   * Delete specific tool embeddings, e.g. tools that were disabled.
+   * @param contentIds content_ids of the tools to delete (e.g. "server:tool-name")
+   * @returns Number of deleted rows
+   */
+  async deleteToolEmbeddingsByContentIds(contentIds: string[]): Promise<number> {
+    if (contentIds.length === 0) return 0;
+    try {
+      const result = await getAppDataSource().query(
+        `DELETE FROM vector_embeddings
+         WHERE content_type = $1
+           AND content_id IN (SELECT unnest($2::text[]))`,
+        ['tool', contentIds],
+      );
+      return result.rowCount ?? result[1] ?? 0;
+    } catch (error) {
+      logger.error('Error deleting tool embeddings', contentIds, error);
+      return 0;
+    }
+  }
+
   /**
    * Delete tool and server embeddings for a specific server
    * @param serverName Server name
```

**File**: `src/services/mcpService.ts` (modified, +82/-12)
```diff
@@ -49,7 +49,11 @@ import config from '../config/index.js';
 import { validateServerName } from '../utils/serverNameValidation.js';
 import { getGroup } from './sseService.js';
 import { getServerConfigInGroup, normalizeGroupServers } from './groupService.js';
-import { removeServerToolEmbeddings, saveToolsAsVectorEmbeddings } from './vectorSearchService.js';
+import {
+  removeServerToolEmbeddings,
+  removeToolEmbeddings,
+  saveToolsAsVectorEmbeddings,
+} from './vectorSearchService.js';
 import { OpenAPIClient } from '../clients/openapi.js';
 import { RequestContextService } from './requestContextService.js';
 import { getDataService } from './services.js';
@@ -714,20 +718,78 @@ const applyDescriptionOverridesForEmbedding = async (
   });
 };
 
-const syncToolsAsVectorEmbeddings = async (
+// Tail of the embedding tasks queued per server. A per-user connect and a
+// reindex, or two users connecting at once, often race on the same tool set;
+// queued behind the first run, the second one hits the skip check in
+// saveToolsAsVectorEmbeddings instead of embedding every tool a second time.
+const embeddingSyncTails = new Map<string, Promise<void>>();
+
+// Run `task` after every embedding task already queued for the server. A task
+// must not wait for another queued task of the same server, or both stall.
+const enqueueEmbeddingTask = (serverName: string, task: () => Promise<void>): Promise<void> => {
+  const run = (embeddingSyncTails.get(serverName) ?? Promise.resolve()).then(task);
+  const tail = run.catch(() => undefined);
+  embeddingSyncTails.set(serverName, tail);
+  void tail.then(() => {
+    if (embeddingSyncTails.get(serverName) === tail) embeddingSyncTails.delete(serverName);
+  });
+  return run;
+};
+
+export const syncToolsAsVectorEmbeddings = (
   serverName: string,
   tools: Tool[],
   options?: { reportProgress?: boolean; partial?: boolean },
-): Promise<void> => {
-  const toolsWithOverrides = await applyDescriptionOverridesForEmbedding(serverName, tools);
-  const modelVisibleTools = filterModelVisibleTools(toolsWithOverrides);
-  if (modelVisibleTools.length === 0) {
-    if (options?.partial) return;
-    await removeServerToolEmbeddings(serverName);
-    return;
-  }
+): Promise<void> =>
+  enqueueEmbeddingTask(serverName, async () => {
+    const toolsWithOverrides = await applyDescriptionOverridesForEmbedding(serverName, tools);
+    const modelVisibleTools = filterModelVisibleTools(toolsWithOverrides);
+    if (modelVisibleTools.length === 0) {
+      if (options?.partial) return;
+      await removeServerToolEmbeddings(serverName);
+      return;
+    }
+
+    await saveToolsAsVectorEmbeddings(serverName, modelVisibleTools, options);
+  });
 
-  await saveToolsAsVectorEmbeddings(serverName, modelVisibleTools, options);
+/**
+ * Embed the tools of a credential server, which never connects globally.
+ * Tools disabled in the server's tools config are never embedded: search
+ * filters them out of the hits anyway, but only after they have taken result
+ * slots. A toggle reaches the index without extra wiring: the tools config is
+ * part of the runtime revision, so the next acquire reconnects and re-syncs.
+ *
+ * Two callers, two scopes:
+ * - `partial: true` (every per-user connect): the list is what one user's
+ *   credentials show, and users may see different tools. The rows of the
+ *   listed, enabled tools are added or refreshed and nothing else is pruned,
+ *   so tools only other users see stay indexed. The listed tools that are
+ *   disabled are removed by name, queued before the sync.
+ * - otherwise (the reindex endpoint, which passes the union of every binding's
+ *   tools): the list is complete, so rows of tools outside it are pruned.
+ *
+ * Resolves to the number of tools handed to the vector store.
+ */
+export const syncCredentialServerToolEmbeddings = async (
+  serverName: string,
+  tools: Tool[],
+  options?: { reportProgress?: boolean; partial?: boolean },
+): Promise<number> => {
+  const enabledTools = await filterToolsByConfig(serverName, tools);
+  if (options?.partial) {
+    const enabledNames = new Set(enabledTools.map((tool) => tool.name));
+    const disabledNames = tools
+      .map((tool) => tool.name)
+      .filter((toolName) => !enabledNames.has(toolName));
+    if (disabledNames.length > 0) {
+      void enqueueEmbeddingTask(serverName, () =>
+        removeToolEmbeddings(serverName, disabledNames),
+      ).catch(() => undefined);
+    }
+  }
+  await syncToolsAsVectorEmbeddings(serverName, enabledTools, options);
+  return enabledTools.length;
 };
 
 // Normalize prompt payload to satisfy MCP ListPrompts response schema
@@ -4628,7 +4690,9 @@ const handleReadResourceRequestImpl = async (request: any, extra: any) => {
   }
 };
 
-// Personal runtimes never enter serverInfos, config exports, or shared embedding caches.
+// Personal runtimes never enter serverInfos or config exports. Their tool list
+// is added to the rows under the serve
```

**File**: `src/services/vectorSearchService.ts` (modified, +97/-18)
```diff
@@ -1155,6 +1155,25 @@ const parseEmbeddingMetadata = (metadata: unknown): Record<string, any> | null =
  * @param serverName Server name
  * @param tools Array of tools to save
  */
+/** The text a tool is embedded from, and stored as its row's text_content. */
+const buildToolSearchableText = (tool: Tool): string =>
+  [
+    tool.name,
+    tool.description,
+    // Include input schema properties if available
+    ...(tool.inputSchema && typeof tool.inputSchema === 'object'
+      ? Object.keys(tool.inputSchema).filter((key) => key !== 'type' && key !== 'properties')
+      : []),
+    // Include schema property names if available
+    ...(tool.inputSchema &&
+    tool.inputSchema.properties &&
+    typeof tool.inputSchema.properties === 'object'
+      ? Object.keys(tool.inputSchema.properties)
+      : []),
+  ]
+    .filter(Boolean)
+    .join(' ');
+
 export const saveToolsAsVectorEmbeddings = async (
   serverName: string,
   tools: Tool[],
@@ -1217,13 +1236,54 @@ export const saveToolsAsVectorEmbeddings = async (
       .sort((a, b) => a.localeCompare(b));
     const expectedToolSetHash = buildToolSetHash(tools, smartRoutingConfig.embeddingDocumentPrefix);
 
+    // ── Partial updates: only embed tools whose row is missing or out of date ──
+    // A partial list is one view of the server's index (a single tool update, or
+    // the tools one user's credentials list), so the whole-set check below can
+    // never match it. Compare per tool instead: same content id, model and text.
+    if (options.partial && isDatabaseConnected()) {
+      try {
+        const partialRepo = getRepositoryFactory('vectorEmbeddings')() as VectorEmbeddingRepository;
+        const existingText = new Map(
+          (
+            await partialRepo.getToolIdentityByServerNameAndModel(
+              serverName,
+              persistedEmbeddingModel,
+            )
+          ).map((item) => [item.contentId, item.textContent]),
+        );
+        const staleTools = tools.filter(
+          (tool) =>
+            existingText.get(`${serverName}:${tool.name}`) !== buildToolSearchableText(tool),
+        );
+        const serverEmbStatus = await partialRepo.findEmbeddingStatus('server', serverName);
+        const hasCurrentServerEmbedding =
+          serverEmbStatus?.model === persistedEmbeddingModel &&
+          serverEmbStatus.text_content === serverSearchableText &&
+          serverEmbStatus.hasEmbedding === true;
+        if (staleTools.length === 0 && hasCurrentServerEmbedding) {
+          logger.log(
+            `[Embedding] [${serverName}] Skipping — all ${tools.length} tool(s) of the partial update already indexed (model=${persistedEmbeddingModel})`,
+          );
+          return;
+        }
+        logger.log(
+          `[Embedding] [${serverName}] Partial update: embedding ${staleTools.length} of ${tools.length} tool(s) (model=${persistedEmbeddingModel})`,
+        );
+        tools = staleTools;
+      } catch (partialCheckError: any) {
+        logger.warn(
+          `[Embedding] [${serverName}] Partial freshness check failed, embedding every listed tool: ${partialCheckError?.message ?? partialCheckError}`,
+        );
+      }
+    }
+
     // ── Skip check: avoid regenerating embeddings that are already up-to-date ──
     // Validate exact content IDs and a tool-set hash/version marker to avoid
     // false positives when only counts match but the actual tool set changed.
     // This is an optimization to skip the expensive embedding generation phase when
     // nothing changed, which can save a lot of time for servers with many tools and
     // slow embedding providers. It also prevents rewrites on every server restart.
-    if (isDatabaseConnected()) {
+    if (!options.partial && isDatabaseConnected()) {
       try {
         const skipCheckRepo = getRepositoryFactory(
           'vectorEmbeddings',
@@ -1296,23 +1356,7 @@ export const saveToolsAsVectorEmbeddings = async (
     for (let _toolIdx = 0; _toolIdx < tools.length; _toolIdx++) {
       const tool = tools[_toolIdx];
 
-      // Create searchable text from tool information
-      const searchableText = [
-        tool.name,
-        tool.description,
-        // Include input schema properties if available
-        ...(tool.inputSchema && typeof tool.inputSchema === 'object'
-          ? Object.keys(tool.inputSchema).filter((key) => key !== 'type' && key !== 'properties')
-          : []),
-        // Include schema property names if available
-        ...(tool.inputSchema &&
-        tool.inputSchema.properties &&
-        typeof tool.inputSchema.properties === 'object'
-          ? Object.keys(tool.inputSchema.properties)
-          : []),
-      ]
-        .filter(Boolean)
-        .join(' ');
+      const searchableText = buildToolSearchableText(tool);
 
       logger.debug(
         `[Embedding] [${serverName}] Tool ${_toolIdx + 1}/${tools.length}: "${tool.name}" | raw text: ${searchableText.length} chars | preview: "${searc
```

**File**: `tests/controllers/smartRoutingController.test.ts` (modified, +41/-14)
```diff
@@ -5,7 +5,8 @@ const mockGetDatabaseHealth = jest.fn();
 const mockIsDatabaseConnected = jest.fn();
 const mockInitializeDatabase = jest.fn();
 const mockGetAppDataSource = jest.fn();
-const mockSaveToolsAsVectorEmbeddings = jest.fn();
+const mockSyncToolsAsVectorEmbeddings = jest.fn();
+const mockSyncCredentialServerToolEmbeddings = jest.fn();
 const mockGetServersInfo = jest.fn();
 const mockGetServerToolsForPrincipal = jest.fn();
 const mockListBindingUsernames = jest.fn();
@@ -27,13 +28,11 @@ jest.mock('../../src/db/connection.js', () => ({
   getAppDataSource: mockGetAppDataSource,
 }));
 
-jest.mock('../../src/services/vectorSearchService.js', () => ({
-  saveToolsAsVectorEmbeddings: mockSaveToolsAsVectorEmbeddings,
-}));
-
 jest.mock('../../src/services/mcpService.js', () => ({
   getServersInfo: mockGetServersInfo,
   getServerToolsForPrincipal: mockGetServerToolsForPrincipal,
+  syncToolsAsVectorEmbeddings: mockSyncToolsAsVectorEmbeddings,
+  syncCredentialServerToolEmbeddings: mockSyncCredentialServerToolEmbeddings,
 }));
 
 jest.mock('../../src/dao/DaoFactory.js', () => ({
@@ -84,7 +83,10 @@ beforeEach(() => {
   mockIsDatabaseConnected.mockReturnValue(true);
   mockInitializeDatabase.mockResolvedValue(undefined);
   mockGetAppDataSource.mockReturnValue(mockDataSource);
-  mockSaveToolsAsVectorEmbeddings.mockResolvedValue(undefined);
+  mockSyncToolsAsVectorEmbeddings.mockResolvedValue(undefined);
+  mockSyncCredentialServerToolEmbeddings.mockImplementation(
+    async (_server: string, tools: unknown[]) => tools.length,
+  );
   mockGetServersInfo.mockResolvedValue([defaultServer]);
   mockGetServerToolsForPrincipal.mockResolvedValue([]);
   mockListBindingUsernames.mockResolvedValue([]);
@@ -243,7 +245,7 @@ describe('reindexSmartRouting', () => {
 
     expect(res.status).toHaveBeenCalledWith(403);
     expect(mockDataSourceQuery).not.toHaveBeenCalled();
-    expect(mockSaveToolsAsVectorEmbeddings).not.toHaveBeenCalled();
+    expect(mockSyncToolsAsVectorEmbeddings).not.toHaveBeenCalled();
   });
 
   it('rejects a second pass while one is already running', async () => {
@@ -252,7 +254,7 @@ describe('reindexSmartRouting', () => {
       { name: 'fetch', status: 'connected', enabled: true, tools: [{ name: 'a' }] },
     ]);
     let releaseWrite: () => void = () => {};
-    mockSaveToolsAsVectorEmbeddings.mockImplementation(
+    mockSyncToolsAsVectorEmbeddings.mockImplementation(
       () =>
         new Promise<void>((resolve) => {
           releaseWrite = resolve;
@@ -273,7 +275,7 @@ describe('reindexSmartRouting', () => {
       message: 'A reindex pass is already running',
     });
     expect(mockDataSourceQuery).toHaveBeenCalledTimes(1);
-    expect(mockSaveToolsAsVectorEmbeddings).toHaveBeenCalledTimes(1);
+    expect(mockSyncToolsAsVectorEmbeddings).toHaveBeenCalledTimes(1);
 
     releaseWrite();
     await firstPass;
@@ -337,8 +339,8 @@ describe('reindexSmartRouting', () => {
     await reindexSmartRouting({} as Request, res);
 
     expect(mockDataSourceQuery).toHaveBeenCalledWith('DELETE FROM vector_embeddings');
-    expect(mockSaveToolsAsVectorEmbeddings).toHaveBeenCalledTimes(2);
-    expect(mockSaveToolsAsVectorEmbeddings).toHaveBeenCalledWith(
+    expect(mockSyncToolsAsVectorEmbeddings).toHaveBeenCalledTimes(2);
+    expect(mockSyncToolsAsVectorEmbeddings).toHaveBeenCalledWith(
       'fetch',
       [{ name: 'a' }],
       { reportProgress: true },
@@ -398,7 +400,8 @@ describe('reindexSmartRouting', () => {
       'private-api',
       expect.objectContaining({ username: 'bob', isAdmin: false }),
     );
-    expect(mockSaveToolsAsVectorEmbeddings).toHaveBeenCalledWith(
+    expect(mockSyncToolsAsVectorEmbeddings).not.toHaveBeenCalled();
+    expect(mockSyncCredentialServerToolEmbeddings).toHaveBeenCalledWith(
       'private-api',
       [{ name: 'shared-tool' }, { name: 'admin-only-tool' }],
       { reportProgress: true },
@@ -419,6 +422,30 @@ describe('reindexSmartRouting', () => {
     });
   });
 
+  it('reports the tools left after the disabled-tool mask for a personal-credential server', async () => {
+    mockDataSourceQuery.mockResolvedValueOnce([]); // DELETE
+    mockGetServersInfo.mockResolvedValue([
+      {
+        name: 'private-api',
+        status: 'disconnected',
+        enabled: true,
+        tools: [],
+        config: { credentialTemplate },
+      },
+    ]);
+    mockListBindingUsernames.mockResolvedValue(['bob']);
+    mockFindUserByUsername.mockResolvedValue({ username: 'bob', isAdmin: false });
+    mockGetServerToolsForPrincipal.mockResolvedValue([{ name: 'read' }, { name: 'write' }]);
+    mockSyncCredentialServerToolEmbeddings.mockResolvedValue(1);
+
+    const res = mockRes();
+    await reindexSmartRouting({} as Request, res);
+
+    const payload = res.json.mock.calls[0][0];
+    expect(payload.data.totalTools).toBe(1);
+    expect(payload.data.results[0]).toMatchObject({ serverName: 'private-api', toolCount: 1 });
+  });
+
   it('skips
```

**File**: `tests/db/repositories/vectorEmbeddingRepository.test.ts` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+const mockQuery = jest.fn();
+
+jest.mock('../../../src/db/connection.js', () => ({
+  getAppDataSource: jest.fn(() => ({
+    query: mockQuery,
+    getRepository: jest.fn(() => ({})),
+  })),
+}));
+
+import { VectorEmbeddingRepository } from '../../../src/db/repositories/VectorEmbeddingRepository.js';
+
+describe('VectorEmbeddingRepository', () => {
+  beforeEach(() => {
+    jest.clearAllMocks();
+  });
+
+  it('returns the stored text of each tool row next to its identity', async () => {
+    mockQuery.mockResolvedValue([
+      {
+        content_id: 'notes:notes-list',
+        metadata: { toolSetHash: 'abc' },
+        text_content: 'notes-list List notes',
+      },
+      { content_id: 'notes:notes-get', metadata: '{"toolSetHash":"abc"}', text_content: null },
+    ]);
+
+    const identities = await new VectorEmbeddingRepository().getToolIdentityByServerNameAndModel(
+      'notes',
+      'embed',
+    );
+
+    expect(identities).toEqual([
+      { contentId: 'notes:notes-list', toolSetHash: 'abc', textContent: 'notes-list List notes' },
+      { contentId: 'notes:notes-get', toolSetHash: 'abc', textContent: undefined },
+    ]);
+    expect(mockQuery.mock.calls[0][0]).toContain('text_content');
+  });
+
+  it('deletes exactly the given tool rows', async () => {
+    mockQuery.mockResolvedValue([[], 2]);
+
+    const removed = await new VectorEmbeddingRepository().deleteToolEmbeddingsByContentIds([
+      'notes:notes-delete',
+      'notes:notes-purge',
+    ]);
+
+    expect(removed).toBe(2);
+    const [sql, params] = mockQuery.mock.calls[0];
+    expect(sql).toContain('DELETE FROM vector_embeddings');
+    expect(params).toEqual(['tool', ['notes:notes-delete', 'notes:notes-purge']]);
+  });
+
+  it('does not query for an empty list, and reports 0 when the delete fails', async () => {
+    const repository = new VectorEmbeddingRepository();
+
+    expect(await repository.deleteToolEmbeddingsByContentIds([])).toBe(0);
+    expect(mockQuery).not.toHaveBeenCalled();
+
+    mockQuery.mockRejectedValue(new Error('connection lost'));
+    expect(await repository.deleteToolEmbeddingsByContentIds(['notes:notes-delete'])).toBe(0);
+  });
+});
```

**File**: `tests/fixtures/credential-server.mjs` (modified, +4/-0)
```diff
@@ -17,6 +17,10 @@ server.setRequestHandler('tools/list', async () => ({
       name: 'identity',
       inputSchema: { type: 'object', properties: { delay: { type: 'number' } } },
     },
+    // A credential with more rights lists more tools, as upstream servers often do
+    ...(process.env.PERSONAL_KEY?.startsWith('full-')
+      ? [{ name: 'rotate_identity', inputSchema: { type: 'object', properties: {} } }]
+      : []),
   ],
 }));
 server.setRequestHandler('tools/call', async (request) => {
```

#### Recent Merged Pull Requests:
- **PR #1284** (2026-10-06): fix: allow configuring stdio response buffer limits (@samanhappy)
- **PR #1281** (2026-10-04): fix: restore remote keepalive after tool-call reconnect (@samanhappy)
- **PR #1280** (2026-10-04): fix(deps): patch vulnerable transitive dependencies (@samanhappy)
- **PR #1279** (2026-10-04): fix: prevent JSON DAO settings updates from overwriting each other (@samanhappy)
- **PR #1277** (2026-10-03): feat(mcp): bound private list TTLs by discovery freshness (@samanhappy)
- **PR #1276** (2026-10-03): docs(mcp): define bounded positive list TTL policy (@samanhappy)
- **PR #1275** (2026-10-03): docs(mcp): plan legacy SSE deprecation and migration (@samanhappy)
- **PR #1274** (2026-10-03): test(mcp): complete bounded modern migration acceptance (@samanhappy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
