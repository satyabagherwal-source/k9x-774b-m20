# Forensic Learning Record (Deep Inspection): apache/zookeeper

> **Canonical Artifact**: `07_PROJECT_LEARNING/apache-zookeeper-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apache/zookeeper](https://github.com/apache/zookeeper))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:09:50.374Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/zookeeper`
- **Description**: Apache ZooKeeper
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12816 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `zookeeper-contrib/zookeeper-contrib-huebrowser/zkui/src/zkui/utils.py`
```
#  Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at

#     http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from zkui import settings

from django.http import Http404

def get_cluster_or_404(id):
  try:
    id = int(id)
    if not (0 <= id < len(settings.CLUSTERS)):
      raise ValueError, 'Undefined cluster id.'
  except (TypeError, ValueError):
    raise Http404()

  cluster = settings.CLUSTERS[id]
  cluster['id'] = id

  return cluster


```

### Core Architecture Module: `zookeeper-contrib/zookeeper-contrib-rest/src/python/demo_queue.py`
```
#! /usr/bin/env python

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


# This is a simple message queue built on top of ZooKeeper. In order
# to be used in production it needs better error handling but it's 
# still useful as a proof-of-concept. 

# Why use ZooKeeper as a queue? Highly available by design and has
# great performance.

import sys
import threading
import time

from zkrest import ZooKeeper

class Queue(object):
    def __init__(self, root, zk):
        self.root = root

        self.zk = zk

    def put(self, data):
        self.zk.create("%s/el-" % self.root, str(data), sequence=True, ephemeral=True)

        # creating ephemeral nodes for easy cleanup
        # in a real world scenario you should create
        # normal sequential znodes

    def fetch(self):
        """ Pull an element from the queue

        This function is not blocking if the queue is empty, it will
        just return None.
        """
        children = sorted(self.zk.get_children(self.root), \
            lambda a, b: cmp(a['path'], b['path']))

        if not children:
            return None

        try:
            first = children[0]
            self.zk.delete(first['path'], version=first['version'])
            if 'data64' not in first:
                return ''
            else:
                return first['data64'].decode('base64')

        except (ZooKeeper.WrongVersion, ZooKeeper.NotFound):
            # someone changed the znode between the get and delete
            # this should not happen
            # in practice you should retry the fetch
            raise
        

def main():
    zk = ZooKeeper()
    zk.start_session(expire=60)

    if not zk.exists('/queue'):
        zk.create('/queue')
    q = Queue('/queue', zk)

    print 'Pushing to queue 1 ... 5'
    map(q.put, [1,2,3,4,5])

    print 'Extracting ...'
    while True:
        el = q.fetch()
        if el is None:
            break
        print el    

    zk.close_session()
    zk.delete('/queue')

    print 'Done.'
   

if __name__ == '__main__':
    sys.exit(main())


```

### Core Architecture Module: `zookeeper-contrib/zookeeper-contrib-zkfuse/src/blockingqueue.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
#ifndef __BLOCKINGQUEUE_H__
#define __BLOCKINGQUEUE_H__
 
#include <deque>

#include "mutex.h"
 
using namespace std;
USING_ZKFUSE_NAMESPACE

namespace zk {
 
/**
 * \brief An unbounded blocking queue of elements of type E.
 * 
 * <p>
 * This class is thread safe.
 */
template <class E>
class BlockingQueue {
    public:
        
        /**
         * \brief Adds the specified element to this queue, waiting if necessary 
         * \brief for space to become available.
         * 
         * @param e the element to be added
         */
        void put(E e);
        
        /**
         * \brief Retrieves and removes the head of this queue, waiting if 
         * \brief no elements are present in this queue.
         * 
         * @param timeout how long to wait until an element becomes available,
         *                in milliseconds; if <code>0</code> then wait forever
         * @param timedOut if not NULL then set to true whether this function timed out
         * @return the element from the queue
         */
        E take(int32_t timeout = 0, bool *timedOut = NULL);
        
        /**
         * Returns the current size of this blocking queue.
         * 
         * @return the number of elements in this queue
         */
        int size() const;
        
        /**
         * \brief Returns whether this queue is empty or not.
         * 
         * @return true if this queue has no elements; false otherwise
         */
        bool empty() const;
        
    private:
        
        /**
         * The queue of elements. Deque is used to provide O(1) time 
         * for head elements removal.
         */
        deque<E> m_queue;
        
        /**
         * The mutex used for queue synchronization.
         */
        mutable zkfuse::Mutex m_mutex;
        
        /**
         * The conditionial variable associated with the mutex above.
         */
        mutable Cond m_cond;
        
};

template<class E>
int BlockingQueue<E>::size() const {
    int size;
    m_mutex.Acquire();
    size = m_queue.size();
    m_mutex.Release();
    return size;
}

template<class E>
bool BlockingQueue<E>::empty() const {
    bool isEmpty;
    m_mutex.Acquire();
    isEmpty = m_queue.empty();
    m_mutex.Release();
    return isEmpty;
}

template<class E> 
void BlockingQueue<E>::put(E e) {
    m_mutex.Acquire();
    m_queue.push_back( e );
    m_cond.Signal();
    m_mutex.Release();
}

template<class E> 
    E BlockingQueue<E>::take(int32_t timeout, bool *timedOut) {
    m_mutex.Acquire();
    bool hasResult = true;
    while (m_queue.empty()) {
        if (timeout <= 0) {
            m_cond.Wait( m_mutex );
        } else {
            if (!m_cond.Wait( m_mutex, timeout )) {
                hasResult = false;
                break;
            }
        }
    }
    if (hasResult) {
        E e = m_queue.front();
        m_queue.pop_front();            
        m_mutex.Release();
        if (timedOut) {
            *timedOut = false;
        }
        return e;
    } else {
        m_mutex.Release();
        if (timedOut) {
            *timedOut = true;
        }
        return E();
    }
}

}

#endif  /* __BLOCKINGQUEUE_H__ */


```

### Core Architecture Module: `zookeeper-contrib/zookeeper-contrib-zktreeutil/src/SimpleTree.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef __SIMPLE_TREE_H__
#define __SIMPLE_TREE_H__

#include <vector>
#include <boost/shared_ptr.hpp>

namespace zktreeutil
{
   using std::vector;

   /**
    * \brief A simple tree data-structure template.
    */
   template < class KeyType, class DataType > class SimpleTreeNode
   {
      private:
         /**
          * \brief The type representing simple-tree node smart-pointer.
          */
         typedef boost::shared_ptr< SimpleTreeNode< KeyType, DataType > > SimpleTreeNodeSptr;

      public:
         /**
          * \brief Constructor.
          * 
          * @param isRoot the flag indicating whether the node is root.
          */
         SimpleTreeNode (bool isRoot=false) : isRoot_(isRoot)
         {
         }

         /**
          * \brief Constructor.
          * 
          * @param key the key stored at the tree node
          * @param isRoot the flag indicating whether the node is root
          */
         SimpleTreeNode (const KeyType& key, bool isRoot=false) :
            isRoot_(isRoot), key_(key)
         {
         }

         /**
          * \brief Constructor.
          * 
          * @param key the key stored at the tree node
          * @param val the value stored at the tree node
          * @param isRoot the flag indicating whether the node is root
          */
         SimpleTreeNode (const KeyType& key, const DataType& val, bool isRoot=false) :
            isRoot_(isRoot), key_(key), val_(val)
         {
         }

         /**
          * \brief Destructor.
          */
         ~SimpleTreeNode () throw() {}

         /**
          * \brief Add a child node to this node.
          *
          * @param node the child node to be added
          */
         void addChild (const SimpleTreeNodeSptr node) { children_.push_back (node); }

         /**
          * \brief Sets the key of this node.
          *
          * @param key the key to be set
          */
         void setKey (const KeyType& key) { key_ = key; }

         /**
          * \brief Sets the data of this node.
          *
          * @param val the value to be set
          */
         void setData (const DataType& val) { val_ = val; }

         /**
          * \brief Gets the key of this node.
          *
          * @return the key of this node 
          */
         KeyType getKey () const { return key_; }

         /**
          * \brief Gets the data of this node.
          *
          * @return the value of this node 
          */
         DataType getData () const { return val_; }

         /**
          * \brief Gets the i'th of this node.
          *
          * @param idx the index of the child node
          * @return the child node
          */
         SimpleTreeNodeSptr getChild (unsigned idx) const { return children_[idx]; }

         /**
          * \brief Gets the number of children of this node.
          *
          * @return the number of children
          */
         unsigned numChildren () const { return children_.size(); }

         /**
          * \brief Indicates whether this node is root.
          *
          * @return 'true' if this node is root, 'false' otherwise
          */
         bool isRoot () const { return isRoot_; }

         /**
          * \brief Indicates whether this node is leaf node.
          *
          * @return 'true' if this node is leaf node, 'false' otherwise
          */
         bool isLeaf () const { return !numChildren(); }

      private:
         bool isRoot_;                                        // Flag indicates if the node is root
         KeyType key_;                                        // Key of this node
         DataType val_;                                        // Value of this node
         vector< SimpleTreeNodeSptr > children_;    // List of children of this node
   };
}

#endif // __SIMPLE_TREE_H__

```

### Core Architecture Module: `zookeeper-contrib/zookeeper-contrib-zktreeutil/src/ZkAdaptor.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef __ZK_ADAPTER_H__
#define __ZK_ADAPTER_H__

#include <string>
#include <vector>

extern "C" {
#include "zookeeper.h"
}

namespace zktreeutil
{
    using std::string;
    using std::vector;

    /**
     * \brief A cluster related exception.
     */
    class ZooKeeperException : public std::exception
    {
        public:

            /**
             * \brief Constructor.
             * 
             * @param msg the detailed message associated with this exception
             */
            ZooKeeperException(const string& msg) :
                m_message(msg),
                m_zkErrorCode(0) {}

            /**
             * \brief Constructor.
             * 
             * @param msg the detailed message associated with this exception
             * @param errorCode the ZK error code associated with this exception
             */
            ZooKeeperException(const string &msg, int errorCode) : 
                m_zkErrorCode(errorCode) 
            {
                char tmp[100];
                sprintf( tmp, " (ZK error code: %d)", errorCode );
                m_message = msg + tmp;
            }

            /**
             * \brief Destructor.
             */
            ~ZooKeeperException() throw() {}

            /**
             * \brief Returns detailed description of the exception.
             */
            const char *what() const throw()
            {
                return m_message.c_str();
            }

            /**
             * \brief Returns the ZK error code.
             */
            int getZKErrorCode() const
            {
                return m_zkErrorCode;
            }

        private:

            /**
             * The detailed message associated with this exception.
             */
            string m_message;

            /**
             * The optional error code received from ZK.
             */
            int m_zkErrorCode;

    };

    /**
     * \brief This class encapsulates configuration of a ZK client.
     */
    class ZooKeeperConfig
    {
        public:

            /**
             * \brief Constructor.
             * 
             * @param hosts the comma separated list of host and port pairs of ZK nodes
             * @param leaseTimeout the lease timeout (heartbeat)
             * @param autoReconnect whether to allow for auto-reconnect
             * @param connectTimeout the connect timeout, in milliseconds;
             * @param certs ssl parameters to initiate SSL connection;
             */
            ZooKeeperConfig(const string &hosts, 
                    int leaseTimeout, 
                    bool autoReconnect = true, 
                    long long int connectTimeout = 15000,
                    const string &sslParams = "")
                : m_hosts(hosts),
                m_leaseTimeout(leaseTimeout), 
                m_autoReconnect(autoReconnect),
                m_connectTimeout(connectTimeout),
                m_sslParams(sslParams) {}

            /**
             * \brief Returns the list of ZK hosts to connect to.
             */
            string getHosts() const { return m_hosts; }

            /**
             * \brief Returns the lease timeout.
             */
            int getLeaseTimeout() const { return m_leaseTimeout; }

            /**
             * \brief Returns whether {@link ZooKeeperAdapter} should attempt 
             * \brief to automatically reconnect in case of a connection failure.
             */
            bool getAutoReconnect() const { return m_autoReconnect; }

            /**
             * \brief Gets the connect timeout.
             * 
             * @return the connect timeout
             */
            long long int getConnectTimeout() const { return m_connectTimeout; }

            /**
             * \brief Returns the ssl params
             */
            string getSslParams() const { return m_sslParams; }

        private:

            /**
             * The host addresses of ZK nodes.
             */
            const string m_hosts;

            /**
             * The ZK lease timeout.
             */
            const int m_leaseTimeout;

            /**
             * True if this adapter should attempt to autoreconnect in case
             * the current session has been dropped.
             */
            const bool m_autoReconnect;

            /**
             * How long to wait, in milliseconds, before a connection 
             * is established to ZK.
             */
            const long long int m_connectTimeout;

            /**
             * comma separated ssl parameters to initiate SSL connection.
             */
             const string m_sslParams;
    };

    /**
     * \brief This is a wrapper around ZK C synchrounous API.
     */
    class ZooKeeperAdapter
    {
        public:
            /**
             * \brief Constructor.
             * Attempts to create a ZK adapter, optionally connecting
             * to the ZK. Note, that if the connection is to be established
             * and the given listener is NULL, some events may be lost, 
             * as they may arrive asynchronously before this method finishes.
             * 
             * @param config the ZK configuration
             * @throw ZooKeeperException if cannot establish connection to the given ZK
             */
            ZooKeeperAdapter(ZooKeeperConfig config) throw(ZooKeeperException);

            /**
             * \brief Destructor.
             */
            ~ZooKeeperAdapter(); 

            /**
             * \brief Returns the current config.
             */
            const ZooKeeperConfig &getZooKeeperConfig() const { return m_zkConfig; }

            /**
             * \brief Restablishes connection to the ZK. 
             * If this adapter is already connected, the current connection 
             * will be dropped and a new connection will be established.
             * 
             * @throw ZooKeeperException if cannot establish connection to the ZK
             */
            void reconnect() throw(ZooKeeperException);

            /**
             * \brief Disconnects from the ZK and unregisters {@link #mp_zkHandle}.
             */
            void disconnect();

            /**
             * \brief Creates a new node identified by the given path. 
             * This method will optionally attempt to create all missing ancestors.
             * 
             * @param path the absolute path name of the node to be created
             * @param value the initial value to be associated with the node
             * @param flags the ZK flags of the node to be created
             * @param createAncestors if true and there are some missing ancestor nodes, 
             *        this method will attempt to create them
             * 
             * @return true if the node has been successfully created; false otherwise
             * @throw ZooKeeperException if the operation has failed
             */ 
            bool createNode(const string &path, 
                    const string &value = "", 
                    int flags = 0, 
                    bool createAncestors = true) throw(ZooKeeperException);

            /**
             * \brief Deletes a node identified by the given path.
             * 
             * @param path the absolute path name of the node to be deleted
             * @param recursive if true this method will attempt to remove 
             *                  all children of the given node if any exist
             * @param version the expected version of the node. The function will 
             *                fail if the actual version of the node does not match 
             *                the expected version
             * 
             * @return true if the node has been deleted; false otherwise
             * @throw ZooKeeperException if the operation has failed
             */
            bool deleteNode(const string &path,
                    bool recursive = false,
                    int version = -1) throw(ZooKeeperException);

            /**
             * \brief Retrieves list of all children of the given node.
             * 
             * @param path the absolute path name of the node for which to get children
             * @return the list of absolute paths of child nodes, possibly empty
             * @throw ZooKeeperException if the operation has failed
             */
            vector<string> getNodeChildren( const string &path) throw(ZooKeeperException);

            /**
             * \brief Check the existence of path to a znode.
             * 
             * @param path the absolute path name of the znode
             * @return TRUE if the znode exists; FALSE otherwise
             * @throw ZooKeeperException if the operation has failed
             */
            bool nodeExists(const string &path) throw(ZooKeeperException);

            /**
             * \brief Gets the given node's data.
             * 
             * @param path the absolute path name of the node to get data from
             * 
             * @return the node's data
             * @throw ZooKeeperException if the operation has failed
  
```

### Core Architecture Module: `zookeeper-contrib/zookeeper-contrib-zktreeutil/src/ZkTreeUtil.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef __ZK_TREE_UTIL_H__
#define __ZK_TREE_UTIL_H__

#include <libxml/parser.h>
#include <libxml/tree.h>
#include "SimpleTree.h"
#include "ZkAdaptor.h"

namespace zktreeutil
{

#define ZKTREEUTIL_INF 1000000000
    /**
     * \brief A structure containing ZK node data.
     */
    struct ZkNodeData
    {
        /**
         * \brief The value string of the ZK node.
         */
        string value;

        /**
         * \brief The flag indicating whether children of the
         * \brief node shduld be ignored during create/diff/update
         */
        bool ignoreUpdate;

        /**
         * \brief Constructor.
         *
         * @param val the value string
         * @param ignore the flag indicating ignore any update/diff
         */
        ZkNodeData (const string& val, bool ignore=false)
            : value (val), ignoreUpdate (ignore) {}

        /**
         * \brief Constructor.
         *
         * @param ignore the flag indicating ignore any update/diff
         */
        ZkNodeData (bool ignore=false)
            : ignoreUpdate (ignore) {}
    };

    /**
     * \brief The type representing a ZK Treenode
     */
    typedef SimpleTreeNode< string, ZkNodeData > ZkTreeNode;

    /**
     * \brief The type representing a ZK Treenode smart-pointer
     */
    typedef boost::shared_ptr< ZkTreeNode > ZkTreeNodeSptr;

    /**
     * \brief The type representing a ZK Adapter smart-pointer
     */
    typedef boost::shared_ptr< ZooKeeperAdapter > ZooKeeperAdapterSptr;

    /**
     * \brief A structure defining a particular action on ZK node;
     * \brief the action can be any of -
     * \brief        CREAT- <zknode>                : creates <zknode> recussively
     * \brief        DELET- <zknode>              : deletes <zknode> recursively
     * \brief        VALUE- <zknode> <value>     : sets <value> to <zknode>
     */
    struct ZkAction
    {
        /**
         * \brief The action type; any of create/delete/setvalue.
         */
        enum ZkActionType
        {
            NONE,
            CREATE,
            DELETE,
            VALUE,
        };

        /**
         * \brief action of this instance
         */
        ZkActionType action;

        /**
         * \brief ZK node key
         */
        string key;

        /**
         * \brief value to be set, if action is setvalue
         */
        string newval;

        /**
         * \brief existing value of the ZK node key
         */
        string oldval;

        /**
         * \brief Constructor.
         */
        ZkAction ()
            : action (ZkAction::NONE) {}

        /**
         * \brief Constructor.
         *
         * @param act the action to be taken
         * @param k the key on which action to be taken
         */
        ZkAction (ZkActionType act, const string& k)
            : action(act),
            key(k) {}

        /**
         * \brief Constructor.
         *
         * @param act the action to be taken
         * @param k the key on which action to be taken
         * @param v the value of the ZK node key
         */
        ZkAction (ZkActionType act, const string& k, const string& v)
            : action(act),
            key(k),
            newval(v) {}

        /**
         * \brief Constructor.
         *
         * @param act the action to be taken
         * @param k the key on which action to be taken
         * @param nv the new value of the ZK node key
         * @param ov the old value of the ZK node key
         */
        ZkAction (ZkActionType act, const string& k, const string& nv, const string& ov)
            : action (act),
            key(k),
            newval(nv),
            oldval(ov) {}
    };

    /**
     * \brief The ZK tree utility class; supports loading ZK tree from ZK server OR
     * \brief from saved XML file, saving ZK tree into XML file, dumping the ZK tree
     * \brief on standard output, creting a diff between saved ZK tree and live ZK
     * \brief tree and incremental update of the live ZK tree.
     */
    class ZkTreeUtil
    {
        public:
            /**
             * \brief Execution flag on ZkAction
             */
            enum ZkActionExecuteFlag
            {
                NONE = 0,
                PRINT = 1,
                EXECUTE = 2,
                INTERACTIVE = 5,
            };

        public:
            /**
             * \brief Connects to zookeeper and returns a valid ZK handle
             *
             * @param zkHosts comma separated list of host:port forming ZK quorum
             * @param cert certificate file path
             * @param a valid ZK handle
             */
            static ZooKeeperAdapterSptr get_zkHandle (const string& zkHosts, const string& cert="");


        public:
            /**
             * \brief Constructor.
             */
            ZkTreeUtil () : loaded_(false) {}

            /**
             * \brief loads the ZK tree from ZK server into memory
             *
             * @param zkHosts comma separated list of host:port forming ZK quorum
             * @param path path to the subtree to be loaded into memory
             * @param force forces reloading in case tree already loaded into memory
             */
            void loadZkTree (const string& zkHosts, const string& path="/", bool force=false);

            /**
             * \brief loads the ZK tree from XML file into memory
             *
             * @param zkXmlConfig ZK tree XML file
             * @param force forces reloading in case tree already loaded into memory
             */
            void loadZkTreeXml (const string& zkXmlConfig, bool force=false);

            /**
             * \brief writes the in-memory ZK tree on to ZK server
             *
             * @param zkHosts comma separated list of host:port forming ZK quorum
             * @param path path to the subtree to be written to ZK tree
             * @param force forces cleanup of the ZK tree on the ZK server before writing
             */
            void writeZkTree (const string& zkHosts, const string& path="/", bool force=false) const;

            /**
             * \brief dupms the in-memory ZK tree on the standard output device;
             *
             * @param xml flag indicates whether tree should be dumped in XML format
             * @param depth the depth of the tree to be dumped for non-xml dump
             */
            void dumpZkTree (bool xml=false, int depth=ZKTREEUTIL_INF) const;

            /** 
             * \brief returns a list of actions after taking a diff of in-memory
             * \brief ZK tree and live ZK tree.
             *
             * @param zkHosts comma separated list of host:port forming ZK quorum
             * @param path path to the subtree in consideration while taking diff with ZK tree
             * @return a list of ZKAction instances to be performed on live ZK tree
             */
            vector< ZkAction > diffZkTree (const string& zkHosts, const string& path="/") const;

            /**
             * \brief performs create/delete/setvalue by executing a set of
             * ZkActions on a live ZK tree.
             *
             * @param zkHosts comma separated list of host:port forming ZK quorum
             * @param zkActions set of ZkActions
             * @param execFlags flags indicating print/execute/interactive etc
             */
            void executeZkActions (const string& zkHosts,
                    const vector< ZkAction >& zkActions,
                    int execFlags) const;

            /**
             * \brief Sets the ssl params to be used for SSL connection
             * @param cert ssl params
             */
             void setSslParams(const string& cert)
             {
                 sslParams_ = cert;
             }

            /**
             * \brief Gets the ssl params
             * @return the cert
             */
             string getSslParams() const { return sslParams_; }

        private:

            ZkTreeNodeSptr zkRootSptr_;     // ZK tree root node
            bool loaded_;                        // Flag indicating whether ZK tree loaded into memory
            string sslParams_;              // Comma separated parameters to initiate SSL connection
    };
}

#endif // __ZK_TREE_UTIL_H__

```

### Core Architecture Module: `zookeeper-recipes/zookeeper-recipes-queue/src/main/c/include/zoo_queue.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef ZOOKEEPER_QUEUE_H_
#define ZOOKEEPER_QUEUE_H_

#include <zookeeper.h>
#include <pthread.h>

#ifdef __cplusplus
extern "C" {
#endif


/** 
 * \file zoo_queue.h
 * \brief zookeeper recipe for queues.
 */


struct zkr_queue {
    zhandle_t *zh;
    char *path;
    struct ACL_vector *acl;
    pthread_mutex_t pmutex;
    char *node_name;
    int node_name_length;
    char *cached_create_path;
};

typedef struct zkr_queue zkr_queue_t;


/**
 * \brief initializes a zookeeper queue
 *
 * this method instantiates a zookeeper queue
 * \param queue the zookeeper queue to initialize
 * \param zh the zookeeper handle to use
 * \param path the path in zookeeper to use for the queue 
 * \param acl the acl to use in zookeeper.
 * \return return 0 if successful.  
 */
ZOOAPI int zkr_queue_init(zkr_queue_t *queue, zhandle_t* zh, char* path, struct ACL_vector *acl);

/**
 * \brief adds an element to a zookeeper queue
 *
 * this method adds an element to the back of a zookeeper queue.
 * \param queue the zookeeper queue to add the element to
 * \param data a pointer to a data buffer
 * \param buffer_len the length of the buffer
 * \return returns 0 (ZOK) if successful, otherwise returns a zookeeper error code.
 */
ZOOAPI int zkr_queue_offer(zkr_queue_t *queue, const char *data, int buffer_len);

/**
 * \brief returns the head of a zookeeper queue 
 *
 * this method returns the head of a zookeeper queue without removing it.
 * \param queue the zookeeper queue to add the element to
 * \param buffer a pointer to a data buffer
 * \param buffer_len a pointer to the length of the buffer
 * \return returns 0 (ZOK) and sets *buffer_len to the length of data written if successful (-1 if the queue is empty). Otherwise it will set *buffer_len to -1 and return a zookeeper error code. 
 */
ZOOAPI int zkr_queue_element(zkr_queue_t *queue, char *buffer, int *buffer_len);

/**
 * \brief returns the head of a zookeeper queue 
 *
 * this method returns the head of a zookeeper queue without removing it.
 * \param queue the zookeeper queue to get the head of
 * \param buffer a pointer to a data buffer
 * \param buffer_len a pointer to the length of the buffer
 * \return returns 0 (ZOK) and sets *buffer_len to the length of data written if successful (-1 if the queue is empty). Otherwise it will set *buffer_len to -1 and return a zookeeper error code. 
 */
ZOOAPI int zkr_queue_remove(zkr_queue_t *queue, char *buffer, int *buffer_len);

/**
 * \brief removes and returns the head of a zookeeper queue, blocks if necessary 
 *
 * this method returns the head of a zookeeper queue without removing it.
 * \param queue the zookeeper queue to remove and return the head of 
 * \param buffer a pointer to a data buffer
 * \param buffer_len a pointer to the length of the buffer
 * \return returns 0 (ZOK) and sets *buffer_len to the length of data written if successful. Otherwise it will set *buffer_len to -1 and return a zookeeper error code. 
 */
ZOOAPI int zkr_queue_take(zhandle_t *zh, zkr_queue_t *queue, char *buffer, int *buffer_len);

/**
 * \brief destroys a zookeeper queue structure 
 *
 * this destroys a zookeeper queue structure, this is only a local operation and will not affect
 * the state of the queue on the zookeeper server.
 * \param queue the zookeeper queue to destroy
 */
void zkr_queue_destroy(zkr_queue_t *queue);


#ifdef __cplusplus
}
#endif
#endif  //ZOOKEEPER_QUEUE_H_

```

### Core Architecture Module: `zookeeper-recipes/zookeeper-recipes-queue/src/main/c/src/zoo_queue.c`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifdef DLL_EXPORT
#define USE_STATIC_LIB
#endif

#if defined(__CYGWIN__)
#define USE_IPV6
#endif

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <zookeeper_log.h>
#include <time.h>
#include <sys/time.h>
#include <sys/socket.h>
#include <limits.h>
#include <zoo_queue.h>
#include <stdbool.h>
#ifdef HAVE_SYS_UTSNAME_H
#include <sys/utsname.h>
#endif

#ifdef HAVE_GETPWUID_R
#include <pwd.h>
#endif

#define IF_DEBUG(x) if (logLevel==ZOO_LOG_LEVEL_DEBUG) {x;}


static void free_String_vector(struct String_vector *v) {
    if (v->data) {
        int32_t i;
        for (i=0; i<v->count; i++) {
            free(v->data[i]);
        }
        free(v->data);
        v->data = 0;
    }
}


static int vstrcmp(const void* str1, const void* str2) {
    const char **a = (const char**)str1;
    const char **b = (const char**) str2;
    return strcmp(*a, *b); 
}

static void sort_children(struct String_vector *vector) {
    qsort( vector->data, vector->count, sizeof(char*), &vstrcmp);
}


static void concat_path_nodename_n(char *buffer, int len, const char *path, const char *node_name){
    snprintf(buffer, len, "%s/%s", path, node_name); 
}

static char *concat_path_nodename(const char *path, const char *node_name){
    int node_path_length = strlen(path) + 1+ strlen(node_name) +1;
    char *node_path = (char *) malloc(node_path_length * sizeof(char));
    concat_path_nodename_n(node_path, node_path_length, path, node_name);
    return node_path;
}  


static void zkr_queue_cache_create_path(zkr_queue_t *queue){
    if(queue->cached_create_path != NULL){
        free(queue->cached_create_path);
    }
    queue->cached_create_path = concat_path_nodename(queue->path, queue->node_name);
}

ZOOAPI int zkr_queue_init(zkr_queue_t *queue, zhandle_t* zh, char* path, struct ACL_vector *acl){
    queue->zh = zh;
    queue->path = path;
    queue->node_name = "qn-";
    queue->node_name_length = strlen(queue->node_name);
    queue->cached_create_path = NULL;
    queue->acl = acl;
    pthread_mutex_init(&(queue->pmutex), NULL);
    zkr_queue_cache_create_path(queue);
    return 0;
}

static ZOOAPI int create_queue_root(zkr_queue_t *queue){
    return zoo_create(queue->zh, queue->path, NULL, 0, queue->acl, 0, NULL, 0 );
}

static int valid_child_name(zkr_queue_t *queue, const char *child_name){
    return strncmp(queue->node_name, child_name, queue->node_name_length);
}

ZOOAPI int zkr_queue_offer(zkr_queue_t *queue, const char *data, int buffer_len){
    for(;;){
        int rc = zoo_create(queue->zh, queue->cached_create_path, data, buffer_len, queue->acl, ZOO_SEQUENCE, NULL, 0 );
        switch(rc){
            int create_root_rc;
        case ZNONODE:
            create_root_rc = create_queue_root(queue);
            switch(create_root_rc){
            case ZNODEEXISTS:
            case ZOK:
                break;
            default:
                return create_root_rc; 
            }
            break;
        default:
            return rc;
        }
    }
}


ZOOAPI int zkr_queue_element(zkr_queue_t *queue, char *buffer, int *buffer_len){
    int path_length = strlen(queue->path);
    for(;;){
        struct String_vector stvector;
        struct String_vector *vector = &stvector;
        /*Get sorted children*/
        int get_children_rc = zoo_get_children(queue->zh, queue->path, 0, vector);
        switch(get_children_rc){
        case ZOK:
            break;
        case ZNONODE:
            *buffer_len = -1;
            return ZOK;
        default:
            return get_children_rc;
        }
        if(stvector.count == 0){
            *buffer_len = -1;
            return ZOK;
        }

        sort_children(vector);
        /*try all*/
        int i;
        for(i=0; i < stvector.count; i++){
            char *child_name = stvector.data[i];
            int child_path_length = path_length + 1 + strlen(child_name) +1; 
            char child_path[child_path_length];
            concat_path_nodename_n(child_path, child_path_length, queue->path, child_name);
            int get_rc = zoo_get(queue->zh, child_path, 0, buffer, buffer_len, NULL);
            switch(get_rc){
            case ZOK:
                free_String_vector(vector);
                return ZOK;
            case ZNONODE:
                break;
            default:
                free_String_vector(vector);
                return get_rc;
            }
        }
    
        free_String_vector(vector);
    }
}

ZOOAPI int zkr_queue_remove(zkr_queue_t *queue, char *buffer, int *buffer_len){
    int path_length = strlen(queue->path);
    for(;;){
        struct String_vector stvector;
        struct String_vector *vector = &stvector;
        /*Get sorted children*/
        int get_children_rc = zoo_get_children(queue->zh, queue->path, 0, &stvector);
        switch(get_children_rc){
        case ZOK:
            break;
        case ZNONODE:
            *buffer_len = -1;
            return ZOK;
            
        default:
            *buffer_len = -1;
            return get_children_rc;
        }
        if(stvector.count == 0){
            *buffer_len = -1;
            return ZOK;
        }

        sort_children(vector);
        /*try all*/
        int i;
        for( i=0; i < stvector.count; i++){
            char *child_name = stvector.data[i];
            int child_path_length = path_length + 1 + strlen(child_name) +1; 
            char child_path[child_path_length];
            concat_path_nodename_n(child_path, child_path_length, queue->path, child_name);
            int get_rc = zoo_get(queue->zh, child_path, 0, buffer, buffer_len, NULL);
            switch(get_rc){
                int delete_rc;
            case ZOK:
                delete_rc = zoo_delete(queue->zh, child_path, -1);
                switch(delete_rc){
                case ZOK:
                    free_String_vector(vector);
                    return delete_rc;
                case ZNONODE:
                    break;
                default:
                    free_String_vector(vector);
                    *buffer_len = -1;
                    return delete_rc;
                }
                break;
            case ZNONODE:
                break;
            default:
                free_String_vector(vector);
                *buffer_len = -1;
                return get_rc;
            }
        }
        free_String_vector(vector);
    }
}

/**
 * The take_latch structure roughly emulates a Java CountdownLatch with 1 as the initial value.
 * It is meant to be used by a setter thread and a waiter thread.
 * 
 * This latch is specialized to be used with the queue, all latches created for the same queue structure will use the same mutex.
 *
 * The setter thread at some point will call take_latch_setter_trigger_latch() on the thread.
 *
 * The waiter thread creates the latch and at some point either calls take_latch_waiter_await()s or take_latch_waiter_mark_unneeded()s it.
 * The await function will return after the setter thread has triggered the latch.
 * The mark unneeded function will return immediately and avoid some unneeded initialization.
 *
 * Whichever thread is last to call their required function disposes of the latch.
 *
 * The latch may disposed if no threads will call the waiting, marking, or triggering functions using take_latch_destroy_synchronized().
 */

struct take_latch {
    enum take_state {take_init, take_waiting, take_triggered, take_not_needed} state;
    pthread_cond_t latch_condition;
    zkr_queue_t *queue;
};


typedef struct take_latch take_latch_t;  


static void take_latch_init( take_latch_t *latch, zkr_queue_t *queue){
    pthread_mutex_t *mutex = &(queue->pmutex);
    pthread_mutex_lock(mutex);
    latch->state = take_init;
    latch->queue = queue;
    pthread_mutex_unlock(mutex);
}

static take_latch_t *create_take_latch(zkr_queue_t *queue){
    take_latch_t *new_take_latch = (take_latch_t *) malloc(sizeof(take_latch_t));
    take_latch_init(new_take_latch, queue);
    return new_take_latch;
}


//Only call this when you own the mutex
static void take_latch_destroy_unsafe(take_latch_t *latch){
    if(latch->state == take_waiting){
        pthread_cond_destroy(&(latch->latch_condition));
    }
    free(latch);
}

static void take_latch_destroy_synchronized(take_latch_t *latch){
    pthread_mutex_t *mutex = &(latch->queue->pmutex);
    pthread_mutex_lock(mutex);
    take_latch_destroy_unsafe(latch);
    pthread_mutex_unlock(mutex);
}

static void take_latch_setter_trigger_latch(zhandle_t *zh, take_latch_t *latch){
    pthread_mutex_t *mutex = &(latch->queue->pmutex);
    pthread_mutex_lock(mutex);
    switch(latch->state){
    case take_init:
        latch->state = take_triggered;
        break;
    case take_not_needed:
        take_latch_destroy_unsafe(latch);
        break;
    case take_triggered:
        LOG_DEBUG(LOGCALLBACK(zh), ("Error! Latch was triggered twice."));
        break;
    case take_waiting:
        pthread_cond_signal(&(latch->latch_condition));
        break;
    }
    pthread_mutex_unlock(mutex);
}

static void take_latch_waiter_await(zhandle_t *zh, take_latch_t *latch){
    pthread_mutex_t *mutex = &(latch->que
```

### Core Architecture Module: `zookeeper-website/app/lib/utils.ts`
```
//
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type * as React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref) {
        ref.current = value;
      }
    });
  };
}

```

### Core Architecture Module: `zk-merge-pr.py`
```
#!/usr/bin/env python

#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Utility for creating well-formed pull request merges and pushing them to Apache. This script is a modified version
# of the one created by the Spark project (https://github.com/apache/spark/blob/master/dev/merge_spark_pr.py).
#
# Usage: ./zk-merge-pr.py (see config env vars below)
#
# This utility assumes you already have a local ZooKeeper git folder and that you
# have added remotes corresponding to both:
# (i) the github apache ZooKeeper mirror and
# (ii) the apache ZooKeeper git repo.

import json
import os
import re
import subprocess
import sys
import urllib.request, urllib.error, urllib.parse
import getpass
import requests

try:
    import jira.client
    JIRA_IMPORTED = True
except ImportError:
    JIRA_IMPORTED = False

PROJECT_NAME = "zookeeper"

CAPITALIZED_PROJECT_NAME = PROJECT_NAME.upper()

# Remote name which points to the GitHub site
PR_REMOTE_NAME = os.environ.get("PR_REMOTE_NAME", "apache-github")
# Remote name which points to Apache git
PUSH_REMOTE_NAME = os.environ.get("PUSH_REMOTE_NAME", "apache")
# ASF JIRA username
JIRA_USERNAME = os.environ.get("JIRA_USERNAME", "")
# ASF JIRA password
JIRA_PASSWORD = os.environ.get("JIRA_PASSWORD", "")
# ASF JIRA access token
# If it is configured, username and password are dismissed
# Go to https://issues.apache.org/jira/secure/ViewProfile.jspa -> Personal Access Tokens for
# your own token management.
JIRA_ACCESS_TOKEN = os.environ.get("JIRA_ACCESS_TOKEN")
# OAuth key used for issuing requests against the GitHub API. If this is not defined, then requests
# will be unauthenticated. You should only need to configure this if you find yourself regularly
# exceeding your IP's unauthenticated request rate limit. You can create an OAuth key at
# https://github.com/settings/tokens. This script only requires the "public_repo" scope.
GITHUB_OAUTH_KEY = os.environ.get("GITHUB_OAUTH_KEY")

GITHUB_USER = os.environ.get("GITHUB_USER", "apache")
GITHUB_BASE = "https://github.com/%s/%s/pull" % (GITHUB_USER, PROJECT_NAME)
GITHUB_API_BASE = "https://api.github.com/repos/%s/%s" % (GITHUB_USER, PROJECT_NAME)
JIRA_BASE = "https://issues.apache.org/jira/browse"
JIRA_API_BASE = "https://issues.apache.org/jira"
# Prefix added to temporary branches
TEMP_BRANCH_PREFIX = "PR_TOOL"
# TODO Introduce a convention as this is too brittle
RELEASE_BRANCH_PREFIX = "branch-"

DEV_BRANCH_NAME = "master"

DEFAULT_FIX_VERSION = os.environ.get("DEFAULT_FIX_VERSION", "branch-3.5")

def get_json(url):
    try:
        request = urllib.request.Request(url)
        if GITHUB_OAUTH_KEY:
            request.add_header('Authorization', 'token %s' % GITHUB_OAUTH_KEY)
        return json.load(urllib.request.urlopen(request))
    except urllib.error.HTTPError as e:
        if "X-RateLimit-Remaining" in e.headers and e.headers["X-RateLimit-Remaining"] == '0':
            print("Exceeded the GitHub API rate limit; see the instructions in " + \
                  "zk-merge-pr.py to configure an OAuth token for making authenticated " + \
                  "GitHub requests.")
        else:
            print("Unable to fetch URL, exiting: %s" % url)
        sys.exit(-1)


def fail(msg):
    print(msg)
    clean_up()
    sys.exit(-1)


def run_cmd(cmd):
    print(cmd)
    if isinstance(cmd, list):
        return subprocess.check_output(cmd, encoding='utf8')
    else:
        return subprocess.check_output(cmd.split(" "), encoding='utf8')


def continue_maybe(prompt):
    result = input("\n%s (y/n): " % prompt)
    if result.lower().strip() != "y":
        fail("Okay, exiting")

def clean_up():
    if original_head != get_current_branch():
        print("Restoring head pointer to %s" % original_head)
        run_cmd("git checkout %s" % original_head)

    branches = run_cmd("git branch").replace(" ", "").split("\n")

    for branch in [x for x in branches if x.startswith(TEMP_BRANCH_PREFIX)]:
        print("Deleting local branch %s" % branch)
        run_cmd("git branch -D %s" % branch)

def get_current_branch():
    return run_cmd("git rev-parse --abbrev-ref HEAD").replace("\n", "")

# merge the requested PR and return the merge hash
def merge_pr(pr_num, title, pr_repo_desc):

    merge_message = []
    result = input("Would you like to squash the commit messages? (y/n): ")
    if result.lower().strip() == "y":
        # Retrieve the commits separately.
        json_commits = get_json(f"https://api.github.com/repos/{PUSH_REMOTE_NAME}/{PROJECT_NAME}/pulls/{pr_num}/commits")
        if json_commits and isinstance(json_commits, list):
            for commit in json_commits:
                commit_message = commit['commit']['message']
                # Remove empty lines and lines containing "Change-Id:"
                filtered_lines = [line for line in commit_message.split('\n') if 'Change-Id:' not in line and line.strip()]
                modified_commit_message = '\n'.join(filtered_lines)
                if modified_commit_message.strip() != title.strip():
                    merge_message += [modified_commit_message]

    # Check for disapproval reviews.
    json_reviewers = get_json(f"https://api.github.com/repos/{PUSH_REMOTE_NAME}/{PROJECT_NAME}/pulls/{pr_num}/reviews")
    disapproval_reviews = [review['user']['login'] for review in json_reviewers if review['state'] == 'CHANGES_REQUESTED']
    if disapproval_reviews:
        continue_maybe("Warning: There are requested changes. Proceed with merging pull request #%s?" % pr_num)
    # Verify if there are no approved reviews.
    approved_reviewers = [review['user']['login'] for review in json_reviewers if review['state'] == 'APPROVED']
    if not approved_reviewers:
        continue_maybe("Warning: Pull Request does not have an approved review. Proceed with merging pull request #%s?" % pr_num)
    else:
        reviewers_string = ', '.join(approved_reviewers)
        merge_message += [f"Reviewers: {reviewers_string}"]
    # Check the author and the closing line.
    json_pr = get_json(f"https://api.github.com/repos/{PUSH_REMOTE_NAME}/{PROJECT_NAME}/pulls/{pr_num}")
    primary_author = json_pr["user"]["login"]
    if primary_author != "":
        merge_message += [f"Author: {primary_author}"]
    close_line = "Closes #%s from %s" % (pr_num, pr_repo_desc)
    merge_message += [close_line]
    merged_string = '\n'.join(merge_message)

    # Get the latest commit SHA.
    latest_commit_sha = json_pr["head"]["sha"]
    json_status = get_json(f"https://api.github.com/repos/{PUSH_REMOTE_NAME}/{PROJECT_NAME}/commits/{latest_commit_sha}/check-runs")
    # Check if all checks have passed on GitHub.
    all_checks_passed = all(status["conclusion"] == "success" for status in json_status["check_runs"])
    if all_checks_passed:
        print("All checks have passed on the github.")
    else:
        any_in_progress = any(run["status"] == "in_progress" for run in json_status["check_runs"])
        if any_in_progress:
            continue_maybe("Warning: There are pending checks. Would you like to continue the merge?")
        else:
            continue_maybe("Warning: Not all checks have passed on GitHub. Would you like to continue the merge?")

    headers = {
        "Authorization": f"token {GITHUB_OAUTH_KEY}",
        "Accept": "application/vnd.github.v3+json"
    }
    data = {
        "commit_title": title,
        "commit_message": merged_string,
        "merge_method": "squash"
    }

    response = requests.put(f"https://api.github.com/repos/{PUSH_REMOTE_NAME}/{PROJECT_NAME}/pulls/{pr_num}/merge", headers=headers, json=data)

    if response.status_code == 200:
        merge_response_json = response.json()
        merge_commit_sha = merge_response_json.get("sha")
        print(f"Pull request #{pr_num} merged. Sha: #{merge_commit_sha}")
        return merge_commit_sha
    else:
        print(f"Failed to merge pull request #{pr_num}. Status code: {response.status_code}")
        print(response.text)
        exit()

def cherry_pick(pr_num, merge_hash, default_branch):
    pick_ref = input("Enter a branch name [%s]: " % default_branch)
    if pick_ref == "":
        pick_ref = default_branch

    pick_branch_name = "%s_PICK_PR_%s_%s" % (TEMP_BRANCH_PREFIX, pr_num, pick_ref.upper())

    run_cmd("git fetch %s" % PR_REMOTE_NAME)
    run_cmd("git checkout -b %s %s/%s" % (pick_branch_name, PUSH_REMOTE_NAME, pick_ref))

    current_attempt = 0
    max_attempts = 6
    # Check if the merge hash exists
    while not run_cmd("git rev-parse --verify %s" % merge_hash):
        if current_attempt >= max_attempts:
            print("Error: The commit hash does not exist in the local repository.")
            exit()
        current_attempt += 1
        print("Waiting for the merge hash to become available...(10 sec)")
        time.sleep(10)
        run_cmd("git fetch %s" % PR_REMOTE_NAME)

    try:
        run_cmd("git cherry-pick -sx %s" % merge_hash)
    except Exception as e:
        msg = "Error cherry-picking: %s\nWould you like to manually fix-up this merge?" % e
        continue_maybe(msg)
        msg = "Okay, please fix any conflicts and finish the cherry-pick. Finished?"
        continue_maybe(msg)

    continue_maybe("Pick complete (local ref %s). Push to %s?" % (
        p
```

### Core Architecture Module: `zookeeper-client/zookeeper-client-c/include/proto.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#ifndef PROTO_H_
#define PROTO_H_

#ifdef __cplusplus
extern "C" {
#endif

#define ZOO_NOTIFY_OP 0
#define ZOO_CREATE_OP 1
#define ZOO_DELETE_OP 2
#define ZOO_EXISTS_OP 3
#define ZOO_GETDATA_OP 4
#define ZOO_SETDATA_OP 5
#define ZOO_GETACL_OP 6
#define ZOO_SETACL_OP 7
#define ZOO_GETCHILDREN_OP 8
#define ZOO_SYNC_OP 9
#define ZOO_PING_OP 11
#define ZOO_GETCHILDREN2_OP 12
#define ZOO_CHECK_OP 13
#define ZOO_MULTI_OP 14
#define ZOO_CREATE2_OP 15
#define ZOO_RECONFIG_OP 16
#define ZOO_CHECK_WATCHES 17
#define ZOO_REMOVE_WATCHES 18
#define ZOO_CREATE_CONTAINER_OP 19
#define ZOO_DELETE_CONTAINER_OP 20
#define ZOO_CREATE_TTL_OP 21
#define ZOO_CLOSE_OP -11
#define ZOO_SETAUTH_OP 100
#define ZOO_SETWATCHES_OP 101
#define ZOO_SASL_OP 102

#ifdef __cplusplus
}
#endif

#endif /*PROTO_H_*/

```

### Core Architecture Module: `zookeeper-client/zookeeper-client-c/include/recordio.h`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#ifndef __RECORDIO_H__
#define __RECORDIO_H__

#include <sys/types.h>
#include <stdint.h> /* for int64_t */
#ifdef WIN32
#include "winconfig.h"
#endif

#ifdef __cplusplus
extern "C" {
#endif

struct buffer {
    int32_t len;
    char *buff;
};

void deallocate_String(char **s);
void deallocate_Buffer(struct buffer *b);
void deallocate_vector(void *d);
struct iarchive {
    int (*start_record)(struct iarchive *ia, const char *tag);
    int (*end_record)(struct iarchive *ia, const char *tag);
    int (*start_vector)(struct iarchive *ia, const char *tag, int32_t *count);
    int (*end_vector)(struct iarchive *ia, const char *tag);
    int (*deserialize_Bool)(struct iarchive *ia, const char *name, int32_t *);
    int (*deserialize_Int)(struct iarchive *ia, const char *name, int32_t *);
    int (*deserialize_Long)(struct iarchive *ia, const char *name, int64_t *);
    int (*deserialize_Buffer)(struct iarchive *ia, const char *name,
            struct buffer *);
    int (*deserialize_String)(struct iarchive *ia, const char *name, char **);
    void *priv;
};
struct oarchive {
    int (*start_record)(struct oarchive *oa, const char *tag);
    int (*end_record)(struct oarchive *oa, const char *tag);
    int (*start_vector)(struct oarchive *oa, const char *tag, const int32_t *count);
    int (*end_vector)(struct oarchive *oa, const char *tag);
    int (*serialize_Bool)(struct oarchive *oa, const char *name, const int32_t *);
    int (*serialize_Int)(struct oarchive *oa, const char *name, const int32_t *);
    int (*serialize_Long)(struct oarchive *oa, const char *name,
            const int64_t *);
    int (*serialize_Buffer)(struct oarchive *oa, const char *name,
            const struct buffer *);
    int (*serialize_String)(struct oarchive *oa, const char *name, char **);
    void *priv;
};

struct oarchive *create_buffer_oarchive(void);
void close_buffer_oarchive(struct oarchive **oa, int free_buffer);
struct iarchive *create_buffer_iarchive(char *buffer, int len);
void close_buffer_iarchive(struct iarchive **ia);
char *get_buffer(struct oarchive *);
int get_buffer_len(struct oarchive *);

int64_t zoo_htonll(int64_t v);

#ifdef __cplusplus
}
#endif

#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2470** (2026-10-05): **ZOOKEEPER-5054: Netty client should allow every supported TLS ciphers (addendum)**
  *Symptoms*: Fixes testCreateSSLContext_ChaCha20Cipher unit test failure. It uses another approach to test the cipher suites in use.

- **Issue #2469** (2026-10-05): **ZOOKEEPER-5054: Netty client should allow every supported TLS ciphers…**
  *Symptoms*: … (addendum)  Fixes testCreateSSLContext_ChaCha20Cipher unit test failure. It uses another approach to test the cipher suites in use.

- **Issue #2468** (2026-10-05): **ZOOKEEPER-5099: Upgrade jackson-databind to 2.22.3**
  *Symptoms*: to fix known security vulnerabilities.

- **Issue #2467** (2026-10-05): **ZOOKEEPER-5098: Upgrade netty to 4.1.138**
  *Symptoms*: to fix known security vulnerabilities.

- **Issue #2466** (2026-10-02): **ZOOKEEPER-5100: Fixed formatting of configuration-parameters.mdx to fix website build**
  *Symptoms*: Executed `cd zookeeper-website && npm run lint:fix` and we have to escape asterisk in mathematical expression.
  **Post-Mortem & Fix Analysis**:
  > Merged. Please create separate pull request for `branch-3.9` (will be backported to `branch-3.8` too).

- **Issue #2465** (2026-10-01): **ZOOKEEPER-5054: Netty client should allow every supported TLS ciphers**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Merged. Thanks!

- **Issue #2464** (2026-09-30): **ZOOKEEPER-4946: Fix Login renewal thread not exiting on shutdown**
  *Symptoms*: Backport of #2446 to `branch-3.9`.  This brings the fix for a Kerberos shutdown hang to 3.9. The production changes are unchanged from the original PR. I moved the setting's documentation to the files used on this branch and marked it new in 3.9.7. In `ShellTest`, I replaced `Thread.onSpinWait()` with `Thread.yield()` so the test compiles with Java 8. 
  **Post-Mortem & Fix Analysis**:
  > Merged. Thanks @ikxeno !
  > @anmolnar @kezhuw   Thank you both! I’ll mark the Jira ticket as resolved.

- **Issue #2458** (2026-09-18): **ZOOKEEPER-5089 Upgrade Website and Docs to new ReactRouter and Vite versions**
  *Symptoms*: Note: the minimal supported Node version is now `24.18.1`
  **Post-Mortem & Fix Analysis**:
  > @anmolnar @PDavid could you please update the wiki docs? the new minimal supported Node.js version is `24.18.1`. 24 is the new LTS for Node.js.  https://cwiki.apache.org/confluence/spaces/ZOOKEEPER/pages/430408714/WebSiteSetup+New
  > Many thanks @yuriipalam for the contribution! :+1: 
  > > @anmolnar @PDavid could you please update the wiki docs? the new minimal supported Node.js version is `24.18.1`. 24 is the new LTS for Node.js. >  > https://cwiki.apache.org/confluence/spaces/ZOOKEEPER/pages/430408714/WebSiteSetup+New  This is done.  Btw. @yuriipalam I remember I asked you to move and maintain this doc page (WebSiteSetup) in the CWiki, but I think I changed my mind and would be better to keep it on the website itself. For instance, under the Documentation menu after Version Control for instance.  wdyt?

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

### Incident Patch 1: `f67ab635` (2026-10-02)
**Commit Message**: ZOOKEEPER-5100: Fixed formatting of configuration-parameters.mdx to fix website build

Reviewers: anmolnar
Author: PDavid
Closes #2466 from PDavid/ZOOKEEPER-5100-website-lint-fix

**File**: `zookeeper-website/app/pages/_docs/docs/_mdx/admin-ops/administrators-guide/configuration-parameters.mdx` (modified, +23/-23)
```diff
@@ -624,29 +624,29 @@ property, when available, is noted below.
   **New in 3.6.0:**
   The size threshold after which a request is considered a large request. If it is -1, then all requests are considered small, effectively turning off large request throttling. The default is -1.
 
-* *multiRead.maxOps* :
-    (Java system property: **zookeeper.multiRead.maxOps**)
-    **New in 3.9.7:**
-    The maximum number of read operations (getData / getChildren) permitted in a single
-    multiRead request. A multiRead can amplify a request that is small on the wire into a
-    very large in-memory response, because every sub-operation result is materialized and
-    held in memory before the response is serialized. This limit, together with
-    *multiRead.maxResponseBytes*, bounds that amplification. A multiRead exceeding this
-    count is rejected with a BadArguments (Code = BADARGUMENTS) error and is not executed.
-    Note that neither *jute.maxbuffer* nor *largeRequestMaxBytes* protects against this,
-    as both bound only the inbound request, not the response it generates. Set to 0 (or a
-    negative value) to disable the check. The default is 1000.
-
-* *multiRead.maxResponseBytes* :
-    (Java system property: **zookeeper.multiRead.maxResponseBytes**)
-    **New in 3.9.7:**
-    The maximum cumulative size, in bytes, of the data materialized while serving a single
-    multiRead request. This is the primary guard against a multiRead response-amplification
-    denial of service. The server accumulates the size of each sub-operation result as the
-    request is processed and rejects the request with a BadArguments (Code = BADARGUMENTS)
-    error as soon as the running total exceeds this value, before the full response is built
-    in heap. Set to 0 (or a negative value) to disable the check. The default is 67108864
-    (64 * 1024 * 1024, i.e. 64 MB).
+* _multiRead.maxOps_ :
+  (Java system property: **zookeeper.multiRead.maxOps**)
+  **New in 3.9.7:**
+  The maximum number of read operations (getData / getChildren) permitted in a single
+  multiRead request. A multiRead can amplify a request that is small on the wire into a
+  very large in-memory response, because every sub-operation result is materialized and
+  held in memory before the response is serialized. This limit, together with
+  _multiRead.maxResponseBytes_, bounds that amplification. A multiRead exceeding this
+  count is rejected with a BadArguments (Code = BADARGUMENTS) error and is not executed.
+  Note that neither _jute.maxbuffer_ nor _largeRequestMaxBytes_ protects against this,
+  as both bound only the inbound request, not the response it generates. Set to 0 (or a
+  negative value) to disable the check. The default is 1000.
+
+* _multiRead.maxResponseBytes_ :
+  (Java system property: **zookeeper.multiRead.maxResponseBytes**)
+  **New in 3.9.7:**
+  The maximum cumulative size, in bytes, of the data materialized while serving a single
+  multiRead request. This is the primary guard against a multiRead response-amplification
+  denial of service. The server accumulates the size of each sub-operation result as the
+  request is processed and rejects the request with a BadArguments (Code = BADARGUMENTS)
+  error as soon as the running total exceeds this value, before the full response is built
+  in heap. Set to 0 (or a negative value) to disable the check. The default is 67108864
+  (64 \* 1024 \* 1024, i.e. 64 MB).
 
 - _outstandingHandshake.limit_
   (Java system property only: **zookeeper.netty.server.outstandingHandshake.limit**)
```

---

### Incident Patch 2: `5143ab88` (2026-09-30)
**Commit Message**: Revert "Check valid voting member before applying (re)config during LE"

This reverts commit 22dad52e25d028c9bd5c2ea7b525b56ce1da1a53.

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/FastLeaderElection.java` (modified, +22/-38)
```diff
@@ -301,47 +301,31 @@ public void run() {
                                 byte[] b = new byte[configLength];
                                 response.buffer.get(b);
 
-                                /*
-                                 * Only adopt a QuorumVerifier carried in a notification if
-                                 * the sender is a voting member of our current (or next)
-                                 * configuration. The election port accepts connections from
-                                 * any sid, so without this gate an unauthenticated peer could
-                                 * push an arbitrary config into processReconfig(), which
-                                 * persists it to the dynamic config file and restarts
-                                 * leader election. Non-voters (observers, joining servers)
-                                 * still get the reply notification below, which carries our
-                                 * own config, so they can learn the current membership.
-                                 */
-                                if (!validVoter(response.sid)) {
-                                    LOG.info("Ignoring config section in notification from non-voter sid={} (config length: {})",
-                                             response.sid, configLength);
-                                } else {
-                                    synchronized (self) {
-                                        try {
-                                            rqv = self.configFromString(new String(b, UTF_8));
-                                            QuorumVerifier curQV = self.getQuorumVerifier();
-                                            if (rqv.getVersion() > curQV.getVersion()) {
-                                                LOG.info("{} Received version: {} my version: {}",
-                                                         self.getMyId(),
-                                                         Long.toHexString(rqv.getVersion()),
-                                                         Long.toHexString(self.getQuorumVerifier().getVersion()));
-                                                if (self.getPeerState() == ServerState.LOOKING) {
-                                                    LOG.debug("Invoking processReconfig(), state: {}", self.getServerState());
-                                                    self.processReconfig(rqv, null, null, false);
-                                                    if (!rqv.equals(curQV)) {
-                                                        LOG.info("restarting leader election");
-                                                        self.shuttingDownLE = true;
-                                                        self.getElectionAlg().shutdown();
-
-                                                        break;
-                                                    }
-                                                } else {
-                                                    LOG.debug("Skip processReconfig(), state: {}", self.getServerState());
+                                synchronized (self) {
+                                    try {
+                                        rqv = self.configFromString(new String(b, UTF_8));
+                                        QuorumVerifier curQV = self.getQuorumVerifier();
+                                        if (rqv.getVersion() > curQV.getVersion()) {
+                                            LOG.info("{} Received version: {} my version: {}",
+                                                     self.getMyId(),
+                                                     Long.toHexString(rqv.getVersion()),
+                                                     Long.toHexString(self.getQuorumVerifier().getVersion()));
+                                            if (self.getPeerState() == ServerState.LOOKING) {
+                                                LOG.debug("Invoking processReconfig(), state: {}", self.getServerState());
+                                                self.processReconfig(rqv, null, null, false);
+                                                if (!rqv.equals(curQV)) {
+                                                    LOG.info("restarting leader election");
+                                                    self.shuttingDownLE = true;
+                                                    self.getElectionAlg().shutdown();
+
+                                                    break;
                                                 }
+                                            } else {
+                                                LOG.debug("Skip processReconfig(), state: {}", self.getServerState());
                                             }
-                                        } catch (IOException | ConfigException e) {
-                                            LOG.error("Some
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/server/quorum/FLEConfigFromNonVoterTest.java` (removed, +0/-151)
```diff
@@ -1,151 +0,0 @@
-/*
- * Licensed to the Apache Software Foundation (ASF) under one
- * or more contributor license agreements.  See the NOTICE file
- * distributed with this work for additional information
- * regarding copyright ownership.  The ASF licenses this file
- * to you under the Apache License, Version 2.0 (the
- * "License"); you may not use this file except in compliance
- * with the License.  You may obtain a copy of the License at
- *
- *     http://www.apache.org/licenses/LICENSE-2.0
- *
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-
-package org.apache.zookeeper.server.quorum;
-
-import static java.nio.charset.StandardCharsets.UTF_8;
-import static org.junit.jupiter.api.Assertions.assertEquals;
-import static org.junit.jupiter.api.Assertions.assertFalse;
-import static org.junit.jupiter.api.Assertions.assertTrue;
-import java.io.File;
-import java.net.InetSocketAddress;
-import java.util.HashMap;
-import java.util.Map;
-import org.apache.zookeeper.PortAssignment;
-import org.apache.zookeeper.ZKTestCase;
-import org.apache.zookeeper.server.quorum.QuorumPeer.QuorumServer;
-import org.apache.zookeeper.server.quorum.QuorumPeer.ServerState;
-import org.apache.zookeeper.server.quorum.flexible.QuorumVerifier;
-import org.apache.zookeeper.test.ClientBase;
-import org.junit.jupiter.api.AfterEach;
-import org.junit.jupiter.api.BeforeEach;
-import org.junit.jupiter.api.Test;
-import org.slf4j.Logger;
-import org.slf4j.LoggerFactory;
-
-/**
- * A notification received on the election port may carry a QuorumVerifier
- * (version >= 0x2). The election port accepts a connection from any sid, so
- * the config section must only be adopted when the sender is a voting member
- * of the receiver's current configuration. Otherwise an unauthenticated peer
- * could inject an arbitrary quorum configuration into a LOOKING server.
- */
-public class FLEConfigFromNonVoterTest extends ZKTestCase {
-
-    protected static final Logger LOG = LoggerFactory.getLogger(FLEConfigFromNonVoterTest.class);
-
-    private static final int COUNT = 3;
-    private static final long ROGUE_SID = 99L;
-
-    private Map<Long, QuorumServer> peers;
-    private File[] tmpdir;
-    private int[] port;
-    private QuorumPeer victim;
-    private QuorumCnxManager[] cnxManagers;
-    private boolean savedReconfigEnabled;
-
-    @BeforeEach
-    public void setUp() throws Exception {
-        savedReconfigEnabled = QuorumPeerConfig.isReconfigEnabled();
-        QuorumPeerConfig.setReconfigEnabled(true);
-
-        peers = new HashMap<>();
-        tmpdir = new File[COUNT + 1];
-        port = new int[COUNT + 1];
-        cnxManagers = new QuorumCnxManager[2];
-
-        for (int i = 0; i < COUNT; i++) {
-            int clientport = PortAssignment.unique();
-            peers.put((long) i, new QuorumServer(i,
-                    new InetSocketAddress("127.0.0.1", PortAssignment.unique()),
-                    new InetSocketAddress("127.0.0.1", PortAssignment.unique()),
-                    new InetSocketAddress("127.0.0.1", clientport)));
-            tmpdir[i] = ClientBase.createTmpDir();
-            port[i] = clientport;
-        }
-        tmpdir[COUNT] = ClientBase.createTmpDir();
-        port[COUNT] = PortAssignment.unique();
-    }
-
-    @AfterEach
-    public void tearDown() throws Exception {
-        for (QuorumCnxManager m : cnxManagers) {
-            if (m != null) {
-                m.halt();
-            }
-        }
-        if (victim != null) {
-            victim.shutdown();
-        }
-        QuorumPeerConfig.setReconfigEnabled(savedReconfigEnabled);
-    }
-
-    @Test
-    public void testConfigFromNonVoterIsIgnored() throws Exception {
-        victim = new QuorumPeer(peers, tmpdir[0], tmpdir[0], port[0], 3, 0, 1000, 2, 2, 2);
-        victim.startLeaderElection();
-        QuorumVerifier originalQV = victim.getQuorumVerifier();
-        long originalVersion = originalQV.getVersion();
-
-        FLETestUtils.LEThread thread = new FLETestUtils.LEThread(victim, 0);
-        thread.start();
-
-        // Rogue peer: not a member of the victim's view, but knows the
-        // victim's election address. Its sid is larger than the victim's so
-        // the victim's QuorumCnxManager keeps the inbound connection.
-        Map<Long, QuorumServer> rogueView = new HashMap<>(peers);
-        rogueView.put(ROGUE_SID, new QuorumServer(ROGUE_SID,
-                new InetSocketAddress("127.0.0.1", PortAssignment.unique()),
-                new InetSocketAddress("127.0.0.1", PortAssignment.unique()),
-                new InetSocketAddress("127.0.0.1", port[COUNT])));
-        QuorumPeer rogue = new QuorumPeer(rogueView, tmpdir[COUNT], tmpdir[
```

---

### Incident Patch 3: `4571e5fb` (2026-09-18)
**Commit Message**: setACL race — missing acl attribute setting

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/PrepRequestProcessor.java` (modified, +8/-0)
```diff
@@ -555,6 +555,14 @@ protected void pRequest2Txn(int type, long zxid, Request request, Record record)
             request.setTxn(new SetACLTxn(path, listACL, newVersion));
             nodeRecord = nodeRecord.duplicate(request.getHdr().getZxid());
             nodeRecord.stat.setAversion(newVersion);
+            // Publish the new ACL onto the outstanding ChangeRecord. getRecordForPath()
+            // serves this record (in preference to the committed tree) to every request
+            // prepped before this setACL commits, so without this line those requests are
+            // authorized against the stale, pre-revocation ACL and their writes linearize
+            // after the revocation (TOCTOU). Mirrors the create path, which already sets
+            // the ACL on its ChangeRecord. ACL is not part of the node digest, so this
+            // does not affect digest calculation.
+            nodeRecord.acl = listACL;
             nodeRecord.precalculatedDigest = precalculateDigest(
                     DigestOpCode.UPDATE, path, nodeRecord.data, nodeRecord.stat);
             setTxnDigest(request, nodeRecord.precalculatedDigest);
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/server/PrepRequestProcessorTest.java` (modified, +65/-0)
```diff
@@ -49,6 +49,7 @@
 import org.apache.zookeeper.proto.CreateRequest;
 import org.apache.zookeeper.proto.ReconfigRequest;
 import org.apache.zookeeper.proto.RequestHeader;
+import org.apache.zookeeper.proto.SetACLRequest;
 import org.apache.zookeeper.proto.SetDataRequest;
 import org.apache.zookeeper.server.ZooKeeperServer.ChangeRecord;
 import org.apache.zookeeper.server.persistence.FileTxnSnapLog;
@@ -292,6 +293,70 @@ public void testInvalidPath() throws Exception {
         assertEquals(outcome.getException().code(), KeeperException.Code.BADARGUMENTS);
     }
 
+    /**
+     * A setACL that is prepped but not yet committed must publish the NEW ACL onto
+     * its outstanding ChangeRecord. getRecordForPath() serves that record to every
+     * request prepped before the setACL commits, so if it still carries the old ACL
+     * those requests are authorized against the pre-revocation ACL (TOCTOU).
+     *
+     * This is the direct regression test for the missing
+     * {@code nodeRecord.acl = listACL;} in the setACL case: before the fix the
+     * outstanding record keeps the old OPEN_ACL_UNSAFE; after the fix it carries the
+     * new read-only ACL.
+     */
+    @Test
+    public void testSetACLPublishesNewAclOnOutstandingChangeRecord() throws Exception {
+        zks.getZKDatabase().dataTree.createNode("/foo", new byte[0], Ids.OPEN_ACL_UNSAFE, 0, 0, 0, 0);
+        assertNull(zks.outstandingChangesForPath.get("/foo"));
+
+        pLatch = new CountDownLatch(1);
+        processor = new PrepRequestProcessor(zks, new MyRequestProcessor());
+        SetACLRequest setAcl = new SetACLRequest("/foo", Ids.READ_ACL_UNSAFE, -1);
+        // admin identity so the ADMIN permission check is not what is under test here
+        processor.pRequest(createRequest(setAcl, OpCode.setACL, true));
+        assertTrue(pLatch.await(5, TimeUnit.SECONDS), "request hasn't been processed in chain");
+
+        ChangeRecord cr = zks.outstandingChangesForPath.get("/foo");
+        assertNotNull(cr, "Change record wasn't set");
+        assertEquals(Ids.READ_ACL_UNSAFE, cr.acl,
+                "Outstanding ChangeRecord must carry the new ACL so later preps are checked against it");
+    }
+
+    /**
+     * End-to-end (at the prep layer) version of the above: a client's write that is
+     * prepped while an ACL revocation is still outstanding must be checked against the
+     * NEW ACL and denied. Before the fix the write is authorized against the stale ACL
+     * and would commit after the revocation.
+     */
+    @Test
+    public void testRacingWriteAfterAclRevocationIsDenied() throws Exception {
+        // Node is world-writable to start with (OPEN_ACL_UNSAFE grants ALL to world:anyone).
+        zks.getZKDatabase().dataTree.createNode("/foo", new byte[0], Ids.OPEN_ACL_UNSAFE, 0, 0, 0, 0);
+
+        processor = new PrepRequestProcessor(zks, new MyRequestProcessor());
+
+        // 1. A world client revokes write access: setACL -> read-only. This is prepped and
+        //    left in outstandingChangesForPath (not yet committed). OPEN_ACL_UNSAFE grants
+        //    ADMIN, so the world client is allowed to perform the setACL.
+        pLatch = new CountDownLatch(1);
+        SetACLRequest setAcl = new SetACLRequest("/foo", Ids.READ_ACL_UNSAFE, -1);
+        processor.pRequest(createRequest(setAcl, OpCode.setACL, false));
+        assertTrue(pLatch.await(5, TimeUnit.SECONDS), "setACL hasn't been processed in chain");
+        assertNull(outcome.getException(), "setACL revocation should succeed");
+
+        // 2. The same world client now tries to write while the revocation is still
+        //    outstanding. It must be checked against the new read-only ACL and denied.
+        pLatch = new CountDownLatch(1);
+        SetDataRequest setData = new SetDataRequest("/foo", "evil".getBytes(), -1);
+        processor.pRequest(createRequest(setData, OpCode.setData, false));
+        assertTrue(pLatch.await(5, TimeUnit.SECONDS), "setData hasn't been processed in chain");
+
+        assertEquals(OpCode.error, outcome.getHdr().getType(),
+                "write racing an outstanding ACL revocation must fail");
+        assertEquals(KeeperException.Code.NOAUTH, outcome.getException().code(),
+                "write racing an outstanding ACL revocation must be denied against the new ACL");
+    }
+
     private class MyRequestProcessor implements RequestProcessor {
 
         @Override
```

---

### Incident Patch 4: `ec016b6a` (2026-09-29)
**Commit Message**: ZOOKEEPER-4946: Fix Login renewal thread not exiting on shutdown

Reviewers: kezhuw
Author: ikxeno
Closes #2446 from ikxeno/ZOOKEEPER-4946

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/Login.java` (modified, +12/-2)
```diff
@@ -69,6 +69,11 @@ public class Login {
     private static final long MIN_TIME_BEFORE_RELOGIN = Long.getLong(
       MIN_TIME_BEFORE_RELOGIN_CONFIG_KEY, DEFAULT_MIN_TIME_BEFORE_RELOGIN);
 
+    private static final long DEFAULT_SHUTDOWN_TIMEOUT = 5 * 1000L;
+    public static final String SHUTDOWN_TIMEOUT_CONFIG_KEY = "zookeeper.kerberos.shutdownTimeoutMs";
+    private static final long SHUTDOWN_TIMEOUT = Math.max(0L,
+            Long.getLong(SHUTDOWN_TIMEOUT_CONFIG_KEY, DEFAULT_SHUTDOWN_TIMEOUT));
+
     private Subject subject = null;
     private Thread t = null;
     private boolean isKrbTicket = false;
@@ -132,7 +137,7 @@ public Login(final String loginContextName, Supplier<CallbackHandler> callbackHa
         t = new Thread(new Runnable() {
             public void run() {
                 LOG.info("TGT refresh thread started.");
-                while (true) {  // renewal thread's main loop. if it exits from here, thread will exit.
+                while (!Thread.currentThread().isInterrupted()) {  // renewal thread's main loop. if it exits from here, thread will exit.
                     KerberosTicket tgt = getTGT();
                     long now = Time.currentWallTime();
                     long nextRefresh;
@@ -262,6 +267,7 @@ public void run() {
                                     }
                                 } else {
                                     LOG.error("Could not refresh TGT for principal: {}.", principal, le);
+                                    break;
                                 }
                             }
                         }
@@ -297,9 +303,13 @@ public void shutdown() {
         if ((t != null) && (t.isAlive())) {
             t.interrupt();
             try {
-                t.join();
+                t.join(SHUTDOWN_TIMEOUT);
+                if (t.isAlive()) {
+                    LOG.warn("TGT renewal thread did not exit within {} ms", SHUTDOWN_TIMEOUT);
+                }
             } catch (InterruptedException e) {
                 LOG.warn("error while waiting for Login thread to shutdown.", e);
+                Thread.currentThread().interrupt();
             }
         }
     }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/Shell.java` (modified, +2/-0)
```diff
@@ -235,6 +235,7 @@ public void run() {
                 errThread.join();
             } catch (InterruptedException ie) {
                 LOG.warn("Interrupted while reading the error stream", ie);
+                Thread.currentThread().interrupt();
             }
             completed.set(true);
             //the timeout thread handling
@@ -243,6 +244,7 @@ public void run() {
                 throw new ExitCodeException(exitCode, errMsg.toString());
             }
         } catch (InterruptedException ie) {
+            Thread.currentThread().interrupt();
             throw new IOException(ie.toString());
         } finally {
             if ((timeOutTimer != null) && !timedOut.get()) {
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/KerberosTicketRenewalTest.java` (modified, +87/-1)
```diff
@@ -24,6 +24,7 @@
 import static org.junit.jupiter.api.Assertions.assertFalse;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
 import static org.junit.jupiter.api.Assertions.assertTimeout;
+import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
 import static org.junit.jupiter.api.Assertions.assertTrue;
 import java.io.File;
 import java.io.FileWriter;
@@ -34,11 +35,13 @@
 import java.util.concurrent.CountDownLatch;
 import java.util.concurrent.TimeUnit;
 import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.concurrent.atomic.AtomicInteger;
 import java.util.function.Supplier;
 import javax.security.auth.login.Configuration;
 import javax.security.auth.login.LoginException;
 import org.apache.commons.io.FileUtils;
 import org.apache.commons.io.FilenameUtils;
+import org.apache.zookeeper.common.Time;
 import org.apache.zookeeper.common.ZKConfig;
 import org.apache.zookeeper.server.quorum.auth.KerberosTestUtils;
 import org.apache.zookeeper.server.quorum.auth.MiniKdc;
@@ -72,6 +75,7 @@ public static void setupClass() throws Exception {
     // by default, we should wait at least 1 minute between subsequent TGT renewals.
     // changing it to 500ms.
     System.setProperty(Login.MIN_TIME_BEFORE_RELOGIN_CONFIG_KEY, "500");
+    System.setProperty(Login.SHUTDOWN_TIMEOUT_CONFIG_KEY, "200");
 
     testTempDir = ClientBase.createTmpDir();
     startMiniKdcAndAddPrincipal();
@@ -99,6 +103,7 @@ public static void setupClass() throws Exception {
   @AfterAll
   public static void tearDownClass() {
     System.clearProperty(Login.MIN_TIME_BEFORE_RELOGIN_CONFIG_KEY);
+    System.clearProperty(Login.SHUTDOWN_TIMEOUT_CONFIG_KEY);
     System.clearProperty("java.security.auth.login.config");
     stopMiniKdc();
     if (testTempDir != null) {
@@ -125,6 +130,12 @@ private static class TestableKerberosLogin extends Login {
 
     private AtomicBoolean refreshFailed = new AtomicBoolean(false);
     private CountDownLatch continueRefreshThread = new CountDownLatch(1);
+    private volatile boolean hangUninterruptibly = false;
+    private final CountDownLatch hungThreadLatch = new CountDownLatch(1);
+    private volatile boolean attemptEveryReLogin = false;
+    private final CountDownLatch retrySleeps = new CountDownLatch(2);
+    private final AtomicInteger reLoginAttempts = new AtomicInteger();
+    private volatile int attemptsAtSecondRetrySleep;
 
     public TestableKerberosLogin() throws LoginException {
       super(JAAS_CONFIG_SECTION, () -> {
@@ -136,10 +147,52 @@ public TestableKerberosLogin() throws LoginException {
     protected void sleepBeforeRetryFailedRefresh() throws InterruptedException {
       LOG.info("sleep started due to failed refresh");
       refreshFailed.set(true);
-      continueRefreshThread.await(20, TimeUnit.SECONDS);
+      if (retrySleeps.getCount() == 1) {
+        attemptsAtSecondRetrySleep = reLoginAttempts.get();
+      }
+      retrySleeps.countDown();
+      if (hangUninterruptibly) {
+        while (hungThreadLatch.getCount() > 0) {
+          try {
+            hungThreadLatch.await();
+          } catch (InterruptedException ignored) {
+          }
+        }
+      } else if (!attemptEveryReLogin) {
+        continueRefreshThread.await(20, TimeUnit.SECONDS);
+      }
       LOG.info("sleep due to failed refresh finished");
     }
 
+    @Override
+    protected synchronized void logout() throws LoginException {
+      reLoginAttempts.incrementAndGet();
+      super.logout();
+    }
+
+    @Override
+    public long getLastLogin() {
+      return attemptEveryReLogin ? Time.currentElapsedTime() - TimeUnit.HOURS.toMillis(1) : super.getLastLogin();
+    }
+
+    public void attemptEveryReLogin() {
+      attemptEveryReLogin = true;
+    }
+
+    public void assertRenewalLoopCameRoundAgain(Duration timeout) throws InterruptedException {
+      assertTrue(retrySleeps.await(timeout.toMillis(), TimeUnit.MILLISECONDS),
+          "renewal thread never left the reLogin retry loop");
+      assertTrue(attemptsAtSecondRetrySleep >= 3, "some reLogin attempts were skipped");
+    }
+
+    public void hangUninterruptiblyOnFailedRefresh() {
+      hangUninterruptibly = true;
+    }
+
+    public void releaseHungThread() {
+      hungThreadLatch.countDown();
+    }
+
     public void assertRefreshFailsEventually(Duration timeout) {
       assertEventually(timeout, () -> refreshFailed.get());
     }
@@ -200,6 +253,39 @@ public void shouldRecoverIfKerberosNotAvailableForSomeTime() throws Exception {
   }
 
 
+  @Test
+  public void shouldNotBlockForeverWhenRenewalThreadDoesNotExit() throws Exception {
+    login = new TestableKerberosLogin();
+    login.hangUninterruptiblyOnFailedRefresh();
+    login.startThreadIfNeeded();
+
+    stopMiniKdc();
+    login.assertRefreshFailsEventually(Duration.ofSeconds(15));
+
+    try {
+      assertTimeoutPreemptively(Duration.ofSeconds(10), () -> login.shutdown());
+    } finally {
+      startMiniKdcAndAddPrinci
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/ShellTest.java` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+/*
+ * Licensed to the Apache Software Foundation (ASF) under one
+ * or more contributor license agreements.  See the NOTICE file
+ * distributed with this work for additional information
+ * regarding copyright ownership.  The ASF licenses this file
+ * to you under the Apache License, Version 2.0 (the
+ * "License"); you may not use this file except in compliance
+ * with the License.  You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package org.apache.zookeeper;
+
+import static org.junit.jupiter.api.Assertions.assertNotNull;
+import static org.junit.jupiter.api.Assertions.assertNull;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+import java.io.IOException;
+import java.util.concurrent.CountDownLatch;
+import java.util.concurrent.TimeUnit;
+import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.concurrent.atomic.AtomicReference;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.condition.DisabledOnOs;
+import org.junit.jupiter.api.condition.OS;
+
+public class ShellTest {
+
+    @Test
+    @DisabledOnOs(OS.WINDOWS)
+    public void shouldRestoreInterruptStatusWhenInterruptedWhileWaitingForProcess() throws Exception {
+        CountDownLatch started = new CountDownLatch(1);
+        CountDownLatch finished = new CountDownLatch(1);
+        AtomicBoolean interruptedAfterwards = new AtomicBoolean(false);
+        AtomicReference<IOException> expectedFailure = new AtomicReference<>();
+        AtomicReference<Throwable> unexpectedFailure = new AtomicReference<>();
+
+        Thread runner = new Thread(() -> {
+            started.countDown();
+            try {
+                Shell.execCommand("sh", "-c", "exec >/dev/null 2>&1; sleep 2");
+            } catch (IOException e) {
+                expectedFailure.set(e);
+            } catch (Throwable t) {
+                unexpectedFailure.set(t);
+            } finally {
+                interruptedAfterwards.set(Thread.currentThread().isInterrupted());
+                finished.countDown();
+            }
+        });
+        runner.start();
+
+        assertTrue(started.await(10, TimeUnit.SECONDS), "runner thread did not start");
+
+        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
+        while (runner.getState() != Thread.State.WAITING) {
+            assertTrue(System.nanoTime() < deadline, "runner thread never reached Process.waitFor()");
+            Thread.onSpinWait();
+        }
+        runner.interrupt();
+
+        assertTrue(finished.await(30, TimeUnit.SECONDS), "execCommand did not return");
+        runner.join();
+
+        assertNull(unexpectedFailure.get(), "unexpected failure in runner thread");
+        assertNotNull(expectedFailure.get(), "execCommand was expected to fail with an IOException");
+        assertTrue(interruptedAfterwards.get(), "execCommand cleared the interrupt status");
+    }
+
+}
```

**File**: `zookeeper-website/app/pages/_docs/docs/_mdx/admin-ops/administrators-guide/configuration-parameters.mdx` (modified, +8/-0)
```diff
@@ -1411,6 +1411,14 @@ the integrity of IP-based access controls.
   It is essentially the quorum equivalent of the _zookeeper.sasl.client.canonicalize.hostname_ property for clients.
   The default value is **false** for backwards compatibility.
 
+- _kerberos.shutdownTimeoutMs_
+  (Java system property: **zookeeper.kerberos.shutdownTimeoutMs**)
+  **New in 3.10.0:**
+  The time in milliseconds ZooKeeper waits for the Kerberos TGT renewal thread to exit while shutting down.
+  If the thread is still alive after that, ZooKeeper logs a warning and completes the shutdown.
+  Set it to 0 to wait without a timeout, which is how ZooKeeper behaved before this setting existed.
+  Default: 5000
+
 - _multiAddress.enabled_ :
   (Java system property: **zookeeper.multiAddress.enabled**)
   **New in 3.6.0:**
```

**File**: `zookeeper-website/app/pages/_docs/docs/_mdx/developer/programmers-guide/bindings.mdx` (modified, +7/-0)
```diff
@@ -105,6 +105,13 @@ and [SASL authentication for ZooKeeper](https://cwiki.apache.org/confluence/disp
 - _zookeeper.server.realm_ :
   Realm part of the server principal. By default it is the client principal realm.
 
+- _zookeeper.kerberos.shutdownTimeoutMs_ :
+  **New in 3.10.0:**
+  The time in milliseconds a client waits for the Kerberos TGT renewal thread to exit while closing.
+  If the thread is still alive after that, the client logs a warning and completes the close.
+  Set it to 0 to wait without a timeout, which is how the client behaved before this setting existed.
+  Default: 5000
+
 - _zookeeper.disableAutoWatchReset_ :
   This switch controls whether automatic watch resetting is enabled. Clients automatically
   reset watches during session reconnect by default, this option allows the client to turn off
```

---

### Incident Patch 5: `92f10403` (2026-09-29)
**Commit Message**: ZOOKEEPER-4947: Stop the send loop after SASL authentication fails

Reviewers: kezhuw, anmolnar
Author: 1fanwang
Closes #2443 from 1fanwang/fix-zookeeper-4947-auth-failed-close

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/ClientCnxn.java` (modified, +1/-0)
```diff
@@ -1217,6 +1217,7 @@ public void run() {
                                 eventThread.queueEvent(new WatchedEvent(Watcher.Event.EventType.None, authState, null));
                                 if (state == States.AUTH_FAILED) {
                                     eventThread.queueEventOfDeath();
+                                    break;
                                 }
                             }
                         }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/ZooKeeper.java` (modified, +1/-1)
```diff
@@ -1319,7 +1319,7 @@ public synchronized void register(Watcher watcher) {
      * @throws InterruptedException
      */
     public synchronized void close() throws InterruptedException {
-        if (!cnxn.getState().isAlive()) {
+        if (cnxn.getState() == States.CLOSED) {
             LOG.debug("Close called on already closed client");
             return;
         }
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/TestableZooKeeper.java` (modified, +5/-0)
```diff
@@ -85,6 +85,11 @@ public void run() {
         }
     }
 
+    @Override
+    public boolean testableWaitForShutdown(int wait) throws InterruptedException {
+        return super.testableWaitForShutdown(wait);
+    }
+
     public SocketAddress testableLocalSocketAddress() {
         return super.testableLocalSocketAddress();
     }
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/test/SaslAuthFailTest.java` (modified, +18/-3)
```diff
@@ -18,12 +18,18 @@
 
 package org.apache.zookeeper.test;
 
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.junit.jupiter.api.Assertions.assertTrue;
 import static org.junit.jupiter.api.Assertions.fail;
 import java.io.File;
 import java.io.FileWriter;
 import java.io.IOException;
 import java.util.concurrent.CountDownLatch;
+import java.util.concurrent.TimeUnit;
 import org.apache.zookeeper.CreateMode;
+import org.apache.zookeeper.KeeperException;
+import org.apache.zookeeper.TestableZooKeeper;
 import org.apache.zookeeper.WatchedEvent;
 import org.apache.zookeeper.Watcher.Event.KeeperState;
 import org.apache.zookeeper.ZooDefs.Ids;
@@ -77,7 +83,7 @@ public synchronized void process(WatchedEvent event) {
 
     @Test
     public void testAuthFail() {
-        try (ZooKeeper zk = createClient()) {
+        try (ZooKeeper zk = new ZooKeeper(hostPort, CONNECTION_TIMEOUT, new CountdownWatcher())) {
             zk.create("/path1", null, Ids.CREATOR_ALL_ACL, CreateMode.PERSISTENT);
             fail("Should have gotten exception.");
         } catch (Exception e) {
@@ -88,9 +94,18 @@ public void testAuthFail() {
 
     @Test
     public void testBadSaslAuthNotifiesWatch() throws Exception {
-        try (ZooKeeper ignored = createClient(new MyWatcher(), hostPort)) {
+        try (TestableZooKeeper zk = new TestableZooKeeper(hostPort, CONNECTION_TIMEOUT, new MyWatcher())) {
             // wait for authFailed event from client's EventThread.
-            authFailed.await();
+            assertTrue(authFailed.await(CONNECTION_TIMEOUT, TimeUnit.MILLISECONDS));
+            boolean threadsStopped = zk.testableWaitForShutdown(1000);
+            LOG.info("SASL failure shutdown without close: threadsStopped={}, state={}",
+                     threadsStopped, zk.getState());
+            assertTrue(threadsStopped, "Client threads should stop after SASL authentication fails");
+            assertEquals(ZooKeeper.States.AUTH_FAILED, zk.getState());
+            assertThrows(KeeperException.AuthFailedException.class, () -> zk.exists("/", false));
+            zk.close();
+            assertEquals(ZooKeeper.States.CLOSED, zk.getState());
+            assertTrue(zk.close(CONNECTION_TIMEOUT));
         }
     }
 
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/test/SaslAuthRequiredMultiClientTest.java` (modified, +21/-11)
```diff
@@ -19,10 +19,15 @@
 package org.apache.zookeeper.test;
 
 import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.junit.jupiter.api.Assertions.assertTrue;
 import static org.junit.jupiter.api.Assertions.fail;
+import java.util.concurrent.CountDownLatch;
+import java.util.concurrent.TimeUnit;
 import javax.security.auth.login.Configuration;
 import org.apache.zookeeper.CreateMode;
 import org.apache.zookeeper.KeeperException;
+import org.apache.zookeeper.Watcher.Event.KeeperState;
 import org.apache.zookeeper.ZooDefs.Ids;
 import org.apache.zookeeper.ZooKeeper;
 import org.junit.jupiter.api.AfterAll;
@@ -55,12 +60,7 @@ public void testClientOpWithInvalidSASLUserAuthAfterSuccessLogin() throws Except
         }
 
         resetJaasConfiguration("jaas.conf", "super_wrong", "test");
-        try  (ZooKeeper wrongUserZk = createClient()) {
-            wrongUserZk.create("/bar", null, Ids.CREATOR_ALL_ACL, CreateMode.PERSISTENT);
-            fail("Client with wrong SASL config should not pass SASL authentication.");
-        } catch (KeeperException e) {
-            assertEquals(KeeperException.Code.AUTHFAILED, e.code());
-        }
+        assertClientAuthFailed();
     }
 
     @Test
@@ -73,11 +73,21 @@ public void testClientOpWithInvalidSASLPasswordAuthAfterSuccessLogin() throws Ex
         }
 
         resetJaasConfiguration("jaas.conf", "super", "test_wrongong");
-        try (ZooKeeper wrongPasswordZk = createClient()) {
-            wrongPasswordZk.create("/bar", null, Ids.CREATOR_ALL_ACL, CreateMode.PERSISTENT);
-            fail("Client with wrong SASL config should not pass SASL authentication.");
-        } catch (KeeperException e) {
-            assertEquals(KeeperException.Code.AUTHFAILED, e.code());
+        assertClientAuthFailed();
+    }
+
+    private void assertClientAuthFailed() throws Exception {
+        CountDownLatch authFailed = new CountDownLatch(1);
+        // A rejected connection may disappear before createClient's JMX check.
+        try (ZooKeeper zk = new ZooKeeper(hostPort, CONNECTION_TIMEOUT, event -> {
+            if (event.getState() == KeeperState.AuthFailed) {
+                authFailed.countDown();
+            }
+        })) {
+            assertTrue(authFailed.await(CONNECTION_TIMEOUT, TimeUnit.MILLISECONDS));
+            assertEquals(ZooKeeper.States.AUTH_FAILED, zk.getState());
+            assertThrows(KeeperException.AuthFailedException.class,
+                         () -> zk.create("/bar", null, Ids.CREATOR_ALL_ACL, CreateMode.PERSISTENT));
         }
     }
 
```

---

### Incident Patch 6: `80f83861` (2026-09-15)
**Commit Message**: Add new CVEs to Security page related to 3.8.7 and 3.9.6

**File**: `zookeeper-website/app/pages/_landing/security/content.md` (modified, +122/-0)
```diff
@@ -60,6 +60,11 @@ The following are **not** in scope for private disclosure:
 
 ## Vulnerability reports
 
+- [CVE-2026-84501](#cve-2026-84501)
+- [CVE-2026-84439](#cve-2026-84439)
+- [CVE-2026-79993](#cve-2026-79993)
+- [CVE-2026-59969](#cve-2026-59969)
+- [CVE-2026-59739](#cve-2026-59739)
 - [CVE-2026-24308](#cve-2026-24308)
 - [CVE-2026-24281](#cve-2026-24281)
 - [CVE-2025-58457](#cve-2025-58457)
@@ -71,6 +76,123 @@ The following are **not** in scope for private disclosure:
 - [CVE-2017-5637](#cve-2017-5637)
 - [CVE-2016-5017](#cve-2016-5017)
 
+--
+
+### CVE-2026-84501
+
+**Operational log forgery via newline injection in EnsembleAuthenticationProvider**
+
+**Severity:** moderate
+
+**Affected versions:**
+
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.9.0 through 3.9.5
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.8.0 through 3.8.6
+
+**Description:**
+
+An unauthenticated attacker can inject arbitrary fake log lines into Apache ZooKeeper's operational log by sending a crafted add_auth("ensemble", ...) request containing newline characters (\n). When the ensemble name doesn't match, EnsembleAuthenticationProvider.handleAuthentication() logs the raw, unsanitized name via LOG.warn(). Because SLF4J's {} placeholder preserves embedded newlines, the attacker can forge complete log entries — with arbitrary timestamps, log levels, class names, and messages — that are visually indistinguishable from genuine ZooKeeper log output.
+
+Users are recommended to upgrade to version 3.8.7 or 3.9.6, which fixes the issue.
+
+**Credit:** Youlong Chen Institute of Computing Technology <chenyoulong20g@ict.ac.cn> (finder)
+
+**References:** https://www.cve.org/CVERecord?id=CVE-2026-84501
+
+---
+
+### CVE-2026-84439
+
+**Audit log injection via unsanitized output from multiple sources**
+
+**Severity:** important
+
+**Affected versions:**
+
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.9.0 through 3.9.5
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.8.0 through 3.8.6
+
+**Description:**
+
+When audit logging is enabled (zookeeper.audit.enable=true), an unauthenticated attacker can inject arbitrary fields into Apache ZooKeeper's audit log by sending a digest authentication request with tab characters (\t) embedded in the username. Because the audit log uses tab-separated key=value format, the injected tabs are parsed as legitimate field separators, allowing the attacker to spoof audit results (e.g., injecting result=success), forge operation types, and corrupt forensic evidence.
+
+A log injection vulnerability in Apache ZooKeeper allows a client that can call setACL to inject forged key-value fields into zookeeper_audit.log. When audit logging is enabled, the server serializes attacker-controlled digest ACL ids into the acl= audit field without escaping tab characters. Because audit events are emitted as tab-separated key=value records, a crafted ACL id can make one successful setAcl event appear to contain forged fields such as operation=delete and znode=/forged. This undermines the integrity of downstream audit parsing, alerting, and incident response.
+
+Users are recommended to upgrade to version 3.9.6 or 3.8.7, which fixes the issue.
+
+**Credit:** Youlong Chen Institute of Computing Technology <chenyoulong20g@ict.ac.cn> (reporter)
+
+**References:** https://www.cve.org/CVERecord?id=CVE-2026-84439
+
+---
+
+### CVE-2026-79993
+
+**Missing ACL check on deleteContainer opcode allows unauthorized deletion of any empty persistent/container znode**
+
+**Severity:** critical
+
+**Affected versions:**
+
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.9.0 through 3.9.5
+- Apache ZooKeeper (org.apache.zookeeper:zookeeper) 3.8.0 through 3.8.6
+
+**Description:**
+
+The `deleteContainer` opcode (0x14/20) is processed without verifying the caller's ACL permissions, allowing any authenticated client to delete specific znodes in the data tree regardless of the ACL restrictions on the znode or its parent. This opcode is considered internal-only and the official client doesn't have API for it, but a client that can open a plain TCP session on the ZooKeeper client port (2181 by default) - with NO authentication and NO ACL permissions - can delete any empty persistent znode (including regular persistent nodes, container nodes, and TTL nodes) by issuing the raw protocol OpCode deleteContainer (20). The deleteContainer request path completely skips both the session check and the DELETE ACL check that are enforced by the regular delete (OpCode 2) path. This is an authorization bypass / ACL enforcement bug.
+
+Users are recommended to upgrade to version 3.9.6 or 3.8.7, which fixes the issue.
+
+**Credit:** K <sec-reports@outlook.com> (reporter), z f <tinkerzf@gmail.com> (reporter), 布豪 <1958304602@qq.com> (finder)
+
+**References:** https://www.cve.org/CVERecord?id=CVE-2026-79993
+
+---
+
+### CVE-2026-59969
+
+**Improper validation of certificate with host mismatch in FIPS mode**
+
+**Severity:** 
```

---

### Incident Patch 7: `ccef53ed` (2026-08-31)
**Commit Message**: ZOOKEEPER-5083: Upgrade Jackson-databind to 2.22.2 to fix known security vulnerabilities

Reviewers: anmolnar
Author: PDavid
Closes #2447 from PDavid/ZOOKEEPER-5083-jackson-upgrade

**File**: `pom.xml` (modified, +1/-1)
```diff
@@ -550,7 +550,7 @@
     <jetty.version>12.1.12</jetty.version>
     <!-- Servlet API version required by Jetty EE10 (see ee10.jakarta.servlet.api.version in jetty-ee10) -->
     <jakarta.servlet.version>6.0.0</jakarta.servlet.version>
-    <jackson.version>2.18.8</jackson.version>
+    <jackson.version>2.22.2</jackson.version>
     <jline.version>3.30.14</jline.version>
     <snappy.version>1.1.10.5</snappy.version>
     <kerby.version>2.0.0</kerby.version>
```

---

### Incident Patch 8: `b1d1f479` (2026-08-25)
**Commit Message**: ZOOKEEPER-5080: Fix flaky metric assertion in SnapshotAndRestoreCommandTest

Reviewers: uros-b, anmolnar
Author: IvanKhanas
Closes #2442 from IvanKhanas/ZOOKEEPER-5080

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/server/admin/SnapshotAndRestoreCommandTest.java` (modified, +2/-2)
```diff
@@ -395,14 +395,14 @@ private void validateSnapshotMetrics() {
         Map<String, Object> metrics = MetricsUtils.currentServerMetrics();
         assertEquals(0, (long) metrics.get("snapshot_error_count"));
         assertEquals(0, (long) metrics.get("snapshot_rate_limited_count"));
-        assertTrue((Double) metrics.get("avg_snapshottime") > 0.0);
+        assertEquals(1L, (long) metrics.get("cnt_snapshottime"));
     }
 
     private void validateRestoreMetrics() {
         Map<String, Object> metrics = MetricsUtils.currentServerMetrics();
         assertEquals(0, (long) metrics.get("restore_error_count"));
         assertEquals(0, (long) metrics.get("restore_rate_limited_count"));
-        assertTrue((Double) metrics.get("avg_restore_time") > 0.0);
+        assertEquals(1L, (long) metrics.get("cnt_restore_time"));
     }
 
     public static  File takeSnapshotAndValidate(final int jettyAdminPort, final File dataDir) throws Exception {
```

---

### Incident Patch 9: `988ac5e2` (2026-08-14)
**Commit Message**: ZOOKEEPER-5076: Upgrade JDK to 17 for the Owasp build

Reviewers: ctubbsii
Author: anmolnar
Closes #2437 from anmolnar/ZOOKEEPER-5076

**File**: `Jenkinsfile-owasp` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ pipeline {
 
     tools {
         maven "maven_latest"
-        jdk "jdk_11_latest"
+        jdk "jdk_17_latest"
     }
 
     stages {
```

---

### Incident Patch 10: `53a78e36` (2026-07-17)
**Commit Message**: ZOOKEEPER-5064: Upgrade jackson to 2.18.8 to fix CVEs

Reviewers: PDavid, anmolnar
Author: Kirti2704
Closes #2415 from Kirti2704/ZOOKEEPER-5064

**File**: `pom.xml` (modified, +1/-1)
```diff
@@ -548,7 +548,7 @@
     <commons-cli.version>1.5.0</commons-cli.version>
     <netty.version>4.1.135.Final</netty.version>
     <jetty.version>9.4.58.v20250814</jetty.version>
-    <jackson.version>2.18.1</jackson.version>
+    <jackson.version>2.18.8</jackson.version>
     <jline.version>3.25.1</jline.version>
     <snappy.version>1.1.10.5</snappy.version>
     <kerby.version>2.0.0</kerby.version>
```

---

### Incident Patch 11: `6d6ae51e` (2026-07-07)
**Commit Message**: ZOOKEEPER-5065: Preserve doap.rdf in website builds

Reviewers: anmolnar, PDavid
Author: yuriipalam
Closes #2416 from yuriipalam/ZOOKEEPER-5065

**File**: `zookeeper-website/public/doap.rdf` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+<?xml version="1.0"?>
+<?xml-stylesheet type="text/xsl"?>
+<rdf:RDF xml:lang="en"
+         xmlns="http://usefulinc.com/ns/doap#" 
+         xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" 
+         xmlns:asfext="http://projects.apache.org/ns/asfext#"
+         xmlns:foaf="http://xmlns.com/foaf/0.1/">
+<!--
+Licensed to the Apache Software Foundation (ASF) under one
+or more contributor license agreements.  See the NOTICE file
+distributed with this work for additional information
+regarding copyright ownership.  The ASF licenses this file
+to you under the Apache License, Version 2.0 (the
+"License"); you may not use this file except in compliance
+with the License.  You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+-->
+  <Project rdf:about="https://zookeeper.apache.org/">
+    <created>2011-02-06</created>
+    <license rdf:resource="http://usefulinc.com/doap/licenses/asl20" />
+    <name>Apache ZooKeeper</name>
+    <homepage rdf:resource="https://zookeeper.apache.org/" />
+    <asfext:pmc rdf:resource="https://zookeeper.apache.org" />
+    <shortdesc>A distributed computing platform.</shortdesc>
+    <description>Apache ZooKeeper is an effort to develop and maintain an open-source server which enables highly reliable distributed coordination.</description>
+    <bug-database rdf:resource="https://issues.apache.org/jira/browse/ZOOKEEPER" />
+    <mailing-list rdf:resource="https://zookeeper.apache.org/lists.html" />
+    <download-page rdf:resource="https://www.apache.org/dyn/closer.cgi/zookeeper/" />
+    <programming-language>Java</programming-language>
+    <category rdf:resource="https://projects.apache.org/category/database" />
+
+    <repository>
+      <GitRepository>
+        <location rdf:resource="https://gitbox.apache.org/repos/asf/zookeeper.git"/>
+        <browse rdf:resource="https://github.com/apache/zookeeper"/>
+      </GitRepository>
+    </repository>
+    
+    <maintainer>
+      <foaf:Person>
+        <foaf:name>Apache ZooKeeper Community</foaf:name>
+        <foaf:mbox rdf:resource="mailto:dev@zookeeper.apache.org"/>
+      </foaf:Person>
+    </maintainer>
+
+  </Project>
+</rdf:RDF>
```

---

### Incident Patch 12: `0cb298e8` (2026-07-06)
**Commit Message**: ZOOKEEPER-5059: Kerberos SASL leaks Login refresh threads across QuorumPeer.shutdown()

Author: anmolnar
Closes #2410 from anmolnar/ZOOKEEPER-5059

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/QuorumPeer.java` (modified, +6/-0)
```diff
@@ -1712,6 +1712,12 @@ public void shutdown() {
                 LOG.warn("Error closing logs ", ie);
             }
         }
+        if (authServer != null) {
+            authServer.shutdown();
+        }
+        if (authLearner != null) {
+            authLearner.shutdown();
+        }
     }
 
     /**
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/NullQuorumAuthLearner.java` (modified, +5/-0)
```diff
@@ -31,4 +31,9 @@ public void authenticate(Socket sock, String hostname) {
         return; // simply return don't require auth
     }
 
+    @Override
+    public void shutdown() {
+        // no-op
+    }
+
 }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/NullQuorumAuthServer.java` (modified, +5/-0)
```diff
@@ -32,4 +32,9 @@ public void authenticate(final Socket sock, final DataInputStream din) {
         // simply return don't require auth
     }
 
+    @Override
+    public void shutdown() {
+        // no-op
+    }
+
 }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/QuorumAuthLearner.java` (modified, +4/-0)
```diff
@@ -38,4 +38,8 @@ public interface QuorumAuthLearner {
      */
     void authenticate(Socket sock, String hostname) throws IOException;
 
+    /**
+     * Shutdown the learner and release resources.
+     */
+    void shutdown();
 }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/QuorumAuthServer.java` (modified, +4/-0)
```diff
@@ -38,4 +38,8 @@ public interface QuorumAuthServer {
      */
     void authenticate(Socket sock, DataInputStream din) throws IOException;
 
+    /**
+     * Shut down the server and release resources.
+     */
+    void shutdown();
 }
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/SaslQuorumAuthLearner.java` (modified, +7/-0)
```diff
@@ -144,6 +144,13 @@ public void authenticate(Socket sock, String hostName) throws IOException {
         }
     }
 
+    @Override
+    public void shutdown() {
+        if (learnerLogin != null) {
+            learnerLogin.shutdown();
+        }
+    }
+
     private void checkAuthStatus(Socket sock, QuorumAuth.Status qpStatus) throws SaslException {
         if (qpStatus == QuorumAuth.Status.SUCCESS) {
             LOG.info(
```

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/quorum/auth/SaslQuorumAuthServer.java` (modified, +7/-0)
```diff
@@ -156,6 +156,13 @@ public void authenticate(Socket sock, DataInputStream din) throws SaslException
         }
     }
 
+    @Override
+    public void shutdown() {
+        if (serverLogin != null) {
+            serverLogin.shutdown();
+        }
+    }
+
     private byte[] receive(DataInputStream din) throws IOException {
         QuorumAuthPacket authPacket = new QuorumAuthPacket();
         BinaryInputArchive bia = BinaryInputArchive.getArchive(din);
```

---

### Incident Patch 13: `a8f5478a` (2026-07-01)
**Commit Message**: ZOOKEEPER-5061: ZooKeeper website fixes

Reviewers: anmolnar
Author: yuriipalam
Closes #2413 from yuriipalam/ZOOKEEPER-5061

**File**: `.github/workflows/website.yaml` (modified, +8/-3)
```diff
@@ -32,15 +32,15 @@ jobs:
     timeout-minutes: 120
     runs-on: ubuntu-latest
     steps:
-    - uses: actions/checkout@v6
-    - name: Set up JDK 25
+    - uses: actions/checkout@v7
+    - name: Set up JDK 11
       uses: actions/setup-java@v5
       with:
         java-version: 25
         distribution: temurin
         cache: 'maven'
     - name: Set up Node.js 22
-      uses: actions/setup-node@v5
+      uses: actions/setup-node@v6
       with:
         node-version: 22
         cache: 'npm'
@@ -50,6 +50,11 @@ jobs:
     - name: Install website npm dependencies
       working-directory: zookeeper-website
       run: npm ci
+    - name: Cache Playwright browsers
+      uses: actions/cache@v4
+      with:
+        path: ~/.cache/ms-playwright
+        key: playwright-${{ runner.os }}-${{ hashFiles('zookeeper-website/package-lock.json') }}
     - name: Install Playwright browsers and system dependencies
       working-directory: zookeeper-website
       run: npx playwright install --with-deps
```

**File**: `NOTICE.txt` (modified, +0/-1)
```diff
@@ -18,7 +18,6 @@ These BSD licensed files:
   ./zookeeper-client/zookeeper-client-c/src/hashtable/hashtable_itr.c
   ./zookeeper-client/zookeeper-client-c/src/hashtable/hashtable_itr.h
   ./zookeeper-client/zookeeper-client-c/src/hashtable/hashtable_private.h
-  ./zookeeper-docs/src/main/resources/markdown/skin/prototype.js
 
 This Apache 2.0 licensed file:
 ./zookeeper-contrib/zookeeper-contrib-zooinspector/src/main/java/com/nitido/utils/toaster/Toaster.java
```

**File**: `conf/zoo_sample.cfg` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ clientPort=2181
 # Be sure to read the maintenance section of the 
 # administrator guide before turning on autopurge.
 #
-# https://zookeeper.apache.org/doc/current/zookeeperAdmin.html#sc_maintenance
+# https://zookeeper.apache.org/doc/current/admin-ops/administrators-guide/administration#maintenance
 #
 # The number of snapshots to retain in dataDir
 #autopurge.snapRetainCount=3
```

**File**: `pom.xml` (modified, +0/-3)
```diff
@@ -1094,9 +1094,6 @@
             <exclude>.travis.yml</exclude>
             <exclude>excludeFindBugsFilter.xml</exclude>
             <exclude>README_packaging.md</exclude>
-            <exclude>src/main/resources/markdown/skin/*</exclude>
-            <exclude>src/main/resources/markdown/html/*</exclude>
-            <exclude>src/main/resources/markdown/images/*</exclude>
             <exclude>**/src/test/resources/embedded/*.conf</exclude>
             <!-- contrib -->
             <exclude>**/JMX-RESOURCES</exclude>
```

**File**: `zookeeper-client/zookeeper-client-c/README` (modified, +5/-3)
```diff
@@ -8,7 +8,8 @@ For the latest information about ZooKeeper, please visit our website at:
 and our wiki, at:
    https://cwiki.apache.org/confluence/display/ZOOKEEPER
 
-Full documentation for this release can also be found in ../../docs/index.html
+Full documentation for this release can also be found at:
+   https://zookeeper.apache.org/doc/current/
 
 
 OVERVIEW
@@ -34,8 +35,9 @@ Sync and Async API.
 
 INSTALLATION
 
-Please refer to the "Installation" item under "C Binding" section in file
-".../trunk/zookeeper-docs/src/main/resources/markdown/zookeeperProgrammers.md"
+Please refer to the "Installation" item under "C Binding" in the
+Programmer's Guide:
+   https://zookeeper.apache.org/doc/current/developer/programmers-guide/bindings#installation
 
 EXAMPLE/SAMPLE C CLIENT SHELL
 
```

**File**: `zookeeper-contrib/zookeeper-contrib-huebrowser/zkui/src/zkui/templates/tree.mako` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ ${shared.header("ZooKeeper Browser > Tree > %s > %s" % (cluster['nice_name'], pa
 </table>
 
 <br />
-<a target="_blank" rel="noopener noreferrer" href="http://zookeeper.apache.org/docs/current/zookeeperProgrammers.html#sc_zkStatStructure">Details on stat information.</a>
+<a target="_blank" rel="noopener noreferrer" href="https://zookeeper.apache.org/doc/current/developer/programmers-guide/data-model#zookeeper-stat-structure">Details on stat information.</a>
 
 ${shared.footer()}
 
```

**File**: `zookeeper-contrib/zookeeper-contrib-monitoring/README` (modified, +1/-1)
```diff
@@ -81,5 +81,5 @@ Apache License 2.0 or later.
 ZooKeeper 4letterwords Commands
 -------------------------------
 
-http://zookeeper.apache.org/docs/current/zookeeperAdmin.html#sc_zkCommands
+https://zookeeper.apache.org/doc/current/admin-ops/administrators-guide/commands#the-four-letter-words
 
```

**File**: `zookeeper-recipes/README.txt` (modified, +3/-2)
```diff
@@ -13,8 +13,9 @@ some unit testing with both the c and java recipe code.
 zkr_recipe-name_methodname
 (eg. zkr_lock_lock in zookeeper-recipes-lock/src/c)
 
-6) The various recipes are in ../docs/recipes.html or
-../../docs/reciped.pdf. Also, this is not an exhaustive list by any chance.
+6) The various recipes are documented at
+   https://zookeeper.apache.org/doc/current/developer/recipes
+   Also, this is not an exhaustive list by any chance.
 Zookeeper is used (and can be used) for more than what we have listed in the docs.
 
 7) To run the c tests in all the recipes, 
```

---

### Incident Patch 14: `12d4cb47` (2026-06-24)
**Commit Message**: ZOOKEEPER-5039: Raise to min JDK 17, also build, test with JDK25

Reviewers: kgeisz, anmolnar, anmolnar, tamaashu
Author: PDavid
Closes #2376 from PDavid/ZOOKEEPER-5039-mockito-upgrade

**File**: `.github/workflows/ci.yaml` (modified, +6/-6)
```diff
@@ -32,17 +32,17 @@ jobs:
     strategy:
       matrix:
         profile:
-          - name: 'full-build-jdk8'
-            jdk: 8
+          - name: 'full-build-jdk17'
+            jdk: 17
             args: '-Pfull-build apache-rat:check verify -DskipTests spotbugs:check checkstyle:check'
-          - name: 'full-build-jdk11'
-            jdk: 11
+          - name: 'full-build-jdk25'
+            jdk: 25
             args: '-Pfull-build apache-rat:check verify -DskipTests spotbugs:check checkstyle:check'
           - name: 'full-build-java-tests'
-            jdk: 11
+            jdk: 25
             args: '-Pfull-build verify -Dsurefire-forkcount=1 -DskipCppUnit -Dsurefire.rerunFailingTestsCount=5'
           - name: 'full-build-cppunit-tests'
-            jdk: 11
+            jdk: 25
             args: '-Pfull-build verify -Dtest=_ -DfailIfNoTests=false'
       fail-fast: false
     timeout-minutes: 360
```

**File**: `.github/workflows/e2e.yaml` (modified, +2/-2)
```diff
@@ -25,8 +25,8 @@ jobs:
   compatibility:
     strategy:
       matrix:
-        jdk: [8, 11]
-        zk: [3.5.9, 3.6.3, 3.7.0, nightly]
+        jdk: [17, 25]
+        zk: [3.7.2, 3.8.6, 3.9.5, nightly]
       fail-fast: false
     timeout-minutes: 360
     runs-on: ubuntu-latest
```

**File**: `.github/workflows/manual.yaml` (modified, +2/-2)
```diff
@@ -46,10 +46,10 @@ jobs:
     - uses: actions/checkout@v6
       with:
         ref: ${{ github.event.inputs.buildRef }}
-    - name: Set up JDK 11
+    - name: Set up JDK 17
       uses: actions/setup-java@v5
       with:
-        java-version: 11
+        java-version: 17
         distribution: temurin
         cache: 'maven'
     - name: Show the first log message
```

**File**: `.github/workflows/website.yaml` (modified, +2/-2)
```diff
@@ -33,10 +33,10 @@ jobs:
     runs-on: ubuntu-latest
     steps:
     - uses: actions/checkout@v6
-    - name: Set up JDK 11
+    - name: Set up JDK 25
       uses: actions/setup-java@v5
       with:
-        java-version: 11
+        java-version: 25
         distribution: temurin
         cache: 'maven'
     - name: Set up Node.js 22
```

**File**: `Jenkinsfile` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ pipeline {
                 axes {
                     axis {
                         name 'JAVA_VERSION'
-                        values 'jdk_1.8_latest', 'jdk_11_latest'
+                        values 'jdk_17_latest', 'jdk_25_latest'
                     }
                 }
 
```

**File**: `Jenkinsfile-PreCommit` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ pipeline {
 
     tools {
         maven "maven_latest"
-        jdk "jdk_1.8_latest"
+        jdk "jdk_17_latest"
     }
 
     stages {
```

**File**: `README.md` (modified, +1/-6)
```diff
@@ -2,7 +2,7 @@
 
 <p align="left">
   <a href="https://zookeeper.apache.org/">
-    <img src="https://zookeeper.apache.org/images/zookeeper_small.gif"" alt="https://zookeeper.apache.org/"><br/>
+    <img src="https://zookeeper.apache.org/images/zookeeper_small.gif" alt="https://zookeeper.apache.org/"><br/>
   </a>
 </p>
 
@@ -39,11 +39,6 @@ is voted on and approved by the Apache ZooKeeper PMC:
 
   https://repo1.maven.org/maven2/org/apache/zookeeper/zookeeper
 
-## Java 8
-
-If you are going to compile with Java 1.8, you should use a
-recent release at u211 or above.
-
 # Contributing
 We always welcome new contributors to the project! See [How to Contribute](https://cwiki.apache.org/confluence/display/ZOOKEEPER/HowToContribute) for details on how to submit patches as pull requests and other aspects of our contribution workflow.
 
```

**File**: `dev/docker/Dockerfile` (modified, +3/-2)
```diff
@@ -17,7 +17,7 @@
 # under the License.
 #
 
-FROM maven:3.8.4-jdk-11
+FROM maven:3.8.8-eclipse-temurin-17
 
 RUN apt-get update
 RUN apt-get install -y \
@@ -31,4 +31,5 @@ RUN apt-get install -y \
   libssl-dev \
   libsasl2-modules-gssapi-mit \
   libsasl2-modules \
-  libsasl2-dev
+  libsasl2-dev \
+  gnupg
```

---

### Incident Patch 15: `981a2fd4` (2026-06-22)
**Commit Message**: ZOOKEEPER-5050: Disable AdminServer and enhance documentation to highlight security considerations

Reviewers: eolivelli, phunt
Author: anmolnar
Closes #2389 from anmolnar/ZOOKEEPER-5050

**File**: `zookeeper-server/src/main/java/org/apache/zookeeper/server/admin/AdminServerFactory.java` (modified, +7/-10)
```diff
@@ -28,6 +28,7 @@
 public class AdminServerFactory {
 
     private static final Logger LOG = LoggerFactory.getLogger(AdminServerFactory.class);
+    static final String ENABLE_ADMIN_SERVER_PROPERTY = "zookeeper.admin.enableServer";
 
     /**
      * This method encapsulates the logic for whether we should use a
@@ -38,21 +39,17 @@ public class AdminServerFactory {
      * to pull in Jetty with ZooKeeper.
      */
     public static AdminServer createAdminServer() {
-        if (!"false".equals(System.getProperty("zookeeper.admin.enableServer"))) {
+        if (Boolean.getBoolean(ENABLE_ADMIN_SERVER_PROPERTY)) {
             try {
                 Class<?> jettyAdminServerC = Class.forName("org.apache.zookeeper.server.admin.JettyAdminServer");
                 Object adminServer = jettyAdminServerC.getConstructor().newInstance();
                 return (AdminServer) adminServer;
 
-            } catch (ClassNotFoundException e) {
-                LOG.warn("Unable to start JettyAdminServer", e);
-            } catch (InstantiationException e) {
-                LOG.warn("Unable to start JettyAdminServer", e);
-            } catch (IllegalAccessException e) {
-                LOG.warn("Unable to start JettyAdminServer", e);
-            } catch (InvocationTargetException e) {
-                LOG.warn("Unable to start JettyAdminServer", e);
-            } catch (NoSuchMethodException e) {
+            } catch (ClassNotFoundException
+                     | InstantiationException
+                     | IllegalAccessException
+                     | InvocationTargetException
+                     | NoSuchMethodException e) {
                 LOG.warn("Unable to start JettyAdminServer", e);
             } catch (NoClassDefFoundError e) {
                 LOG.warn("Unable to load jetty, not starting JettyAdminServer", e);
```

**File**: `zookeeper-server/src/test/java/org/apache/zookeeper/server/admin/AdminServerFactoryTest.java` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+/*
+ * Licensed to the Apache Software Foundation (ASF) under one
+ * or more contributor license agreements.  See the NOTICE file
+ * distributed with this work for additional information
+ * regarding copyright ownership.  The ASF licenses this file
+ * to you under the Apache License, Version 2.0 (the
+ * "License"); you may not use this file except in compliance
+ * with the License.  You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package org.apache.zookeeper.server.admin;
+
+import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.Test;
+
+public class AdminServerFactoryTest {
+
+    @AfterEach
+    public void tearDown() {
+        System.clearProperty(AdminServerFactory.ENABLE_ADMIN_SERVER_PROPERTY);
+    }
+
+    @Test
+    public void testAdminServerDisabledByDefault() {
+        System.clearProperty(AdminServerFactory.ENABLE_ADMIN_SERVER_PROPERTY);
+        AdminServer adminServer = AdminServerFactory.createAdminServer();
+        assertTrue(adminServer instanceof DummyAdminServer);
+        assertFalse(adminServer instanceof JettyAdminServer);
+    }
+
+    @Test
+    public void testAdminServerEnabled() {
+        System.setProperty(AdminServerFactory.ENABLE_ADMIN_SERVER_PROPERTY, "true");
+        AdminServer adminServer = AdminServerFactory.createAdminServer();
+        assertFalse(adminServer instanceof DummyAdminServer);
+        assertTrue(adminServer instanceof JettyAdminServer);
+    }
+}
```

**File**: `zookeeper-website/app/pages/_docs/docs/_mdx/admin-ops/administrators-guide/commands.mdx` (modified, +123/-21)
```diff
@@ -183,29 +183,131 @@ $ echo ruok | nc 127.0.0.1 5111
 
 ## The AdminServer
 
-**New in 3.5.0:** The AdminServer is
-an embedded Jetty server that provides an HTTP interface to the four-letter
-word commands. By default, the server is started on port 8080,
-and commands are issued by going to the URL "/commands/\[command name]",
-e.g., http://localhost:8080/commands/stat. The command response is
-returned as JSON. Unlike the original protocol, commands are not
-restricted to four-letter names, and commands can have multiple names;
-for instance, "stmk" can also be referred to as "set_trace_mask". To
-view a list of all available commands, point a browser to the URL
-/commands (e.g., http://localhost:8080/commands). See the [AdminServer configuration options](#configuring-adminserver-for-ssltls)
-for how to change the port and URLs.
-
-The AdminServer is enabled by default, but can be disabled by either:
-
-- Setting the zookeeper.admin.enableServer system
-  property to false.
-- Removing Jetty from the classpath. (This option is
-  useful if you would like to override ZooKeeper's jetty
-  dependency.)
-
-Note that the TCP four-letter word interface is still available if
+**New in 3.5.0:** The AdminServer is an embedded Jetty server that provides an HTTP interface to the four-letter word
+commands. In ZooKeeper releases 3.5.0 through 3.9.x, the AdminServer was enabled by default. Starting with ZooKeeper
+3.10.0, the default configuration disables the AdminServer. When enabled, the server listens on port 8080 by default,
+and commands are issued by accessing the URL `/commands/[command name]`, for example, `http://localhost:8080/commands/stat`.
+Command responses are returned in JSON format.
+
+Unlike the original protocol, commands are not restricted to four-letter names, and commands can have multiple aliases;
+for example, `stmk` can also be referred to as `set_trace_mask`. To view a list of all available commands, access the
+`/commands` endpoint (for example, `http://localhost:8080/commands`). See the AdminServer configuration options for
+information on changing the port and URL mappings.
+
+Beginning with ZooKeeper 3.10.0, the AdminServer is disabled by default and can be enabled by setting the
+`zookeeper.admin.enableServer` system property to `true`. When enabled without additional configuration, the AdminServer
+listens on all network interfaces (`0.0.0.0`), uses unencrypted HTTP, and does not require client authentication.
+Administrators are strongly encouraged to restrict network access and configure appropriate transport security and
+authentication before exposing the AdminServer in production environments.
+
+Make sure that Jetty is available on the classpath, because the AdminServer will automatically remain disabled if Jetty
+cannot be found. This behavior can be useful when overriding ZooKeeper's Jetty dependency.
+
+Note that the TCP four-letter word interface is still available for monitoring purposes if
 the AdminServer is disabled.
 
+### Security Considerations
+
+> **Important:** The AdminServer is disabled by default. When enabled without additional configuration,
+> it listens on all network interfaces (0.0.0.0) on port 8080, uses unencrypted HTTP, and does not
+> require client authentication. As a result, most administrative commands are accessible to any client
+> that can reach the AdminServer. Administrators should restrict access appropriately and enable transport
+> security and authentication when deploying the AdminServer in production.
+
+### Default Security Posture
+
+The default AdminServer configuration is intended for ease of use in trusted environments, but it is **not secure for
+exposure to untrusted networks**.
+
+Default settings include:
+
+- `admin.enableServer=false`
+- `admin.serverAddress=0.0.0.0`
+- `admin.serverPort=8080`
+- `admin.forceHttps=false`
+- `admin.needClientAuth=false`
+
+With these defaults:
+
+- All traffic is transmitted in clear text over HTTP.
+- Administrative data, including configuration and runtime details, can be viewed by anyone with network access.
+- Many commands (such as `stat`, `srvr`, `conf`, and `cons`) do not require authentication.
+- Sensitive operational information may be disclosed.
+- In some environments, unrestricted administrative access can increase the impact of vulnerabilities or misconfiguration.
+
+### Recommended Deployment Practices
+
+Administrators should ensure that the AdminServer is accessible only to authorized users.
+
+#### Option 1: Restrict Access with Firewall Rules (Minimum Recommendation)
+
+Limit access to the AdminServer port to trusted hosts or management networks only.
+
+Examples:
+
+- Bind the server to localhost:
+
+  ```properties
+  admin.serverAddress=127.0.0.1
+  ```
+
+- Use host-based firewall rules (such as `iptables`, `firewalld`, or cloud security groups) to allow access only from
+- administrative systems.
+
+This is the minimum recommended protection when HTTPS and client authen
```

**File**: `zookeeper-website/app/pages/_docs/docs/_mdx/admin-ops/administrators-guide/configuration-parameters.mdx` (modified, +2/-2)
```diff
@@ -1720,8 +1720,8 @@ options are used to configure the [AdminServer](#adminserver-configuration).
 
 - _admin.enableServer_ :
   (Java system property: **zookeeper.admin.enableServer**)
-  Set to "false" to disable the AdminServer. By default the
-  AdminServer is enabled.
+  Set to "true" to enable the AdminServer. By default, the
+  AdminServer is disabled.
 
 - _admin.serverAddress_ :
   (Java system property: **zookeeper.admin.serverAddress**)
```

#### Recent Merged Pull Requests:
- **PR #2470** (2026-10-05): ZOOKEEPER-5054: Netty client should allow every supported TLS ciphers (addendum) (@meszibalu)
- **PR #2469** (2026-10-05): ZOOKEEPER-5054: Netty client should allow every supported TLS ciphers… (@meszibalu)
- **PR #2468** (2026-10-05): ZOOKEEPER-5099: Upgrade jackson-databind to 2.22.3 (@PDavid)
- **PR #2467** (2026-10-05): ZOOKEEPER-5098: Upgrade netty to 4.1.138 (@PDavid)
- **PR #2466** (2026-10-02): ZOOKEEPER-5100: Fixed formatting of configuration-parameters.mdx to fix website build (@PDavid)
- **PR #2465** (2026-10-01): ZOOKEEPER-5054: Netty client should allow every supported TLS ciphers (@meszibalu)
- **PR #2464** (2026-09-30): ZOOKEEPER-4946: Fix Login renewal thread not exiting on shutdown (@ikxeno)
- **PR #2458** (2026-09-18): ZOOKEEPER-5089 Upgrade Website and Docs to new ReactRouter and Vite versions (@yuriipalam)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
