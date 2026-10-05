# Forensic Learning Record (Deep Inspection): sudheerj/reactjs-interview-questions

> **Canonical Artifact**: `07_PROJECT_LEARNING/sudheerj-reactjs-interview-questions-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sudheerj/reactjs-interview-questions](https://github.com/sudheerj/reactjs-interview-questions))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:27:33.768Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sudheerj/reactjs-interview-questions`
- **Description**: List of top 500 ReactJS Interview Questions & Answers....Coding exercise questions are coming soon!!
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 44845 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `coding-exercise/src/exercises/exercise-01-state-batching/Problem.js`
```
import React, { useState } from 'react';

/**
 * CODING EXERCISE 1: State Batching and Event Handlers
 * 
 * PROBLEM:
 * What will be the output after clicking the "Increment" button once?
 * 
 * Options:
 * A) Counter: 3, Alert shows: 3
 * B) Counter: 3, Alert shows: 0
 * C) Counter: 1, Alert shows: 0
 * D) Counter: 1, Alert shows: 1
 * 
 * BONUS: How would you modify this to make the counter increment by 3?
 */

function Problem() {
  const [counter, setCounter] = useState(0);

  const handleIncrement = () => {
    setCounter(counter + 1);
    setCounter(counter + 1);
    setCounter(counter + 1);
    alert(`Counter value: ${counter}`);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>Exercise 1: State Batching Problem</h2>
      <p>Current Counter: {counter}</p>
      <button onClick={handleIncrement}>Increment</button>
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <p><strong>Question:</strong> What will happen when you click the button?</p>
        <p>Think about:</p>
        <ul>
          <li>What value will the counter display?</li>
          <li>What value will the alert show?</li>
          <li>Why does this behavior occur?</li>
        </ul>
      </div>
    </div>
  );
}

export default Problem;

```

### Core Architecture Module: `coding-exercise/src/exercises/exercise-01-state-batching/Solution.js`
```
import React, { useState } from 'react';

/**
 * CODING EXERCISE 1: State Batching and Event Handlers - SOLUTION
 * 
 * ANSWER: C) Counter: 1, Alert shows: 0
 * 
 * EXPLANATION:
 * 
 * 1. STATE CLOSURE:
 *    - When the event handler runs, `counter` is captured with its current value (0)
 *    - All three setCounter calls use the same captured value: counter + 1 = 0 + 1 = 1
 *    - React batches these updates and only applies the last one
 * 
 * 2. ALERT TIMING:
 *    - The alert executes synchronously before React re-renders
 *    - So it shows the old value (0), not the new value (1)
 * 
 * 3. BATCHING:
 *    - React batches multiple setState calls in event handlers for performance
 *    - Since all three calls set the state to the same value (1), the result is just 1
 * 
 * CORRECT APPROACH (Functional Updates):
 * Use the functional form of setState to access the previous state value
 */

function Solution() {
  const [counter, setCounter] = useState(0);
  const [correctCounter, setCorrectCounter] = useState(0);

  // WRONG: Uses stale closure value
  const handleIncrementWrong = () => {
    setCounter(counter + 1);
    setCounter(counter + 1);
    setCounter(counter + 1);
    alert(`Wrong approach - Counter value in alert: ${counter}`);
  };

  // CORRECT: Uses functional updates
  const handleIncrementCorrect = () => {
    setCorrectCounter(prev => prev + 1);
    setCorrectCounter(prev => prev + 1);
    setCorrectCounter(prev => prev + 1);
    // Note: Alert still shows old value because state updates are async
    alert(`Correct approach - Counter value in alert: ${correctCounter} (old value)`);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>Exercise 1: State Batching Solution</h2>
      
      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#ffe6e6', borderRadius: '5px' }}>
        <h3>❌ Wrong Approach (Closure Problem)</h3>
        <p>Current Counter: {counter}</p>
        <button onClick={handleIncrementWrong}>Increment (Wrong)</button>
        <p style={{ fontSize: '14px', marginTop: '10px' }}>
          This only increments by 1 because all three setState calls use the same captured value.
        </p>
      </div>

      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#e6ffe6', borderRadius: '5px' }}>
        <h3>✅ Correct Approach (Functional Updates)</h3>
        <p>Current Counter: {correctCounter}</p>
        <button onClick={handleIncrementCorrect}>Increment (Correct)</button>
        <p style={{ fontSize: '14px', marginTop: '10px' }}>
          This increments by 3 because each setState receives the previous state value.
        </p>
      </div>

      <div style={{ padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <h3>📚 Key Takeaways</h3>
        <ol>
          <li><strong>State is a snapshot:</strong> The state value doesn't change during a render</li>
          <li><strong>Closures capture values:</strong> Event handlers capture the state value from when they were created</li>
          <li><strong>Use functional updates:</strong> When new state depends on previous state, use the function form</li>
          <li><strong>Batching:</strong> React batches multiple setState calls in event handlers</li>
          <li><strong>Async updates:</strong> State updates are asynchronous - you can't read the new value immediately</li>
        </ol>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e6f3ff', borderRadius: '5px' }}>
        <h3>💡 Code Comparison</h3>
        <pre style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '3px', overflow: 'auto' }}>
{`// ❌ WRONG - Uses stale closure
setCounter(counter + 1);  // 0 + 1 = 1
setCounter(counter + 1);  // 0 + 1 = 1
setCounter(counter + 1);  // 0 + 1 = 1
// Result: counter = 1

// ✅ CORRECT - Uses previous state
setCounter(prev => prev + 1);  // 0 + 1 = 1
setCounter(prev => prev + 1);  // 1 + 1 = 2
setCounter(prev => prev + 1);  // 2 + 1 = 3
// Result: counter = 3`}
        </pre>
      </div>
    </div>
  );
}

export default Solution;

```

### Core Architecture Module: `coding-exercise/src/exercises/exercise-01-state-batching/index.js`
```
export { default as Problem } from './Problem';
export { default as Solution } from './Solution';

```

### Core Architecture Module: `coding-exercise/src/exercises/exercise-04-custom-hooks/Problem.js`
```
import React, { useState, useEffect } from 'react';

/**
 * CODING EXERCISE 4: Custom Hooks and Code Reusability
 * 
 * PROBLEM:
 * You have two components that fetch data from different APIs.
 * Both components have similar logic for loading, error handling, and data fetching.
 * 
 * Question: What's wrong with this code?
 * 
 * Options:
 * A) Nothing is wrong, this is the correct way
 * B) Code duplication - should extract into a custom hook
 * C) Missing cleanup in useEffect
 * D) Should use fetch instead of hardcoded data
 * 
 * BONUS: How would you create a reusable custom hook for this pattern?
 */

// Component 1: Fetches user data
function UserProfile() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    // Simulating API call
    setTimeout(() => {
      try {
        setData({ name: 'John Doe', email: 'john@example.com' });
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }, 1000);
  }, []);

  if (loading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error}</div>;
  return (
    <div style={{ padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px', marginBottom: '10px' }}>
      <h4>User Profile</h4>
      <p>Name: {data?.name}</p>
      <p>Email: {data?.email}</p>
    </div>
  );
}

// Component 2: Fetches posts data (DUPLICATE LOGIC!)
function PostsList() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    // Simulating API call
    setTimeout(() => {
      try {
        setData([
          { id: 1, title: 'First Post' },
          { id: 2, title: 'Second Post' }
        ]);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }, 1000);
  }, []);

  if (loading) return <div>Loading posts...</div>;
  if (error) return <div>Error: {error}</div>;
  return (
    <div style={{ padding: '10px', backgroundColor: '#fff3e6', borderRadius: '5px' }}>
      <h4>Posts</h4>
      {data?.map(post => (
        <p key={post.id}>• {post.title}</p>
      ))}
    </div>
  );
}

function Problem() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>Exercise 4: Custom Hooks Problem</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <UserProfile />
        <PostsList />
      </div>

      <div style={{ 
        marginTop: '20px', 
        padding: '10px', 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffc107',
        borderRadius: '5px'
      }}>
        <p><strong>⚠️ Question:</strong> What's the problem with this code?</p>
        <p>Think about:</p>
        <ul>
          <li>Is there code duplication?</li>
          <li>How would you make this reusable?</li>
          <li>What would a custom hook look like?</li>
          <li>What are the benefits of extracting this logic?</li>
        </ul>
        <p style={{ fontSize: '12px', color: '#856404' }}>
          <strong>Hint:</strong> Look at the similar patterns in both components
        </p>
      </div>

      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        backgroundColor: '#ffe6e6', 
        borderRadius: '5px' 
      }}>
        <h4>❌ Code Smell Detected</h4>
        <ul style={{ fontSize: '14px' }}>
          <li>Both components have identical state management (data, loading, error)</li>
          <li>Both have the same useEffect pattern</li>
          <li>Both have the same conditional rendering logic</li>
          <li>If we need to add a feature (e.g., retry), we'd have to update both!</li>
        </ul>
      </div>
    </div>
  );
}

export default Problem;

```

### Core Architecture Module: `coding-exercise/src/exercises/exercise-04-custom-hooks/Solution.js`
```
import React, { useState, useEffect } from 'react';

/**
 * CODING EXERCISE 4: Custom Hooks and Code Reusability - SOLUTION
 * 
 * ANSWER: B) Code duplication - should extract into a custom hook
 * 
 * EXPLANATION:
 * 
 * 1. THE PROBLEM:
 *    - Both components have identical data fetching logic
 *    - Duplicate state management (data, loading, error)
 *    - Hard to maintain - changes need to be made in multiple places
 * 
 * 2. THE SOLUTION:
 *    - Extract common logic into a custom hook
 *    - Custom hooks start with "use" prefix
 *    - Can use other hooks inside (useState, useEffect, etc.)
 *    - Returns values that components need
 * 
 * 3. BENEFITS:
 *    - DRY (Don't Repeat Yourself)
 *    - Easier to test
 *    - Easier to maintain
 *    - Reusable across components
 */

// ✅ SOLUTION: Custom Hook
function useFetch(fetchFunction, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await fetchFunction();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      cancelled = true;
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}

// Simulated API functions
const fetchUser = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ name: 'John Doe', email: 'john@example.com', role: 'Developer' });
    }, 1000);
  });
};

const fetchPosts = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 1, title: 'Understanding React Hooks', likes: 42 },
        { id: 2, title: 'Custom Hooks Best Practices', likes: 38 },
        { id: 3, title: 'Building Reusable Components', likes: 55 }
      ]);
    }, 1200);
  });
};

const fetchComments = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 1, text: 'Great article!', author: 'Alice' },
        { id: 2, text: 'Very helpful, thanks!', author: 'Bob' }
      ]);
    }, 800);
  });
};

// ✅ Component 1: Using custom hook
function UserProfile() {
  const { data, loading, error } = useFetch(fetchUser, []);

  if (loading) return <div style={{ padding: '10px' }}>Loading user...</div>;
  if (error) return <div style={{ padding: '10px', color: 'red' }}>Error: {error}</div>;
  
  return (
    <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px', marginBottom: '10px' }}>
      <h4>👤 User Profile</h4>
      <p><strong>Name:</strong> {data?.name}</p>
      <p><strong>Email:</strong> {data?.email}</p>
      <p><strong>Role:</strong> {data?.role}</p>
    </div>
  );
}

// ✅ Component 2: Using custom hook
function PostsList() {
  const { data, loading, error } = useFetch(fetchPosts, []);

  if (loading) return <div style={{ padding: '10px' }}>Loading posts...</div>;
  if (error) return <div style={{ padding: '10px', color: 'red' }}>Error: {error}</div>;
  
  return (
    <div style={{ padding: '15px', backgroundColor: '#e6ffe6', borderRadius: '5px', marginBottom: '10px' }}>
      <h4>📝 Posts</h4>
      {data?.map(post => (
        <div key={post.id} style={{ marginBottom: '8px' }}>
          <strong>{post.title}</strong> - {post.likes} likes
        </div>
      ))}
    </div>
  );
}

// ✅ Component 3: Using custom hook (easy to add new features!)
function CommentsList() {
  const { data, loading, error } = useFetch(fetchComments, []);

  if (loading) return <div style={{ padding: '10px' }}>Loading comments...</div>;
  if (error) return <div style={{ padding: '10px', color: 'red' }}>Error: {error}</div>;
  
  return (
    <div style={{ padding: '15px', backgroundColor: '#fff3e6', borderRadius: '5px' }}>
      <h4>💬 Comments</h4>
      {data?.map(comment => (
        <div key={comment.id} style={{ marginBottom: '8px' }}>
          <em>"{comment.text}"</em> - {comment.author}
        </div>
      ))}
    </div>
  );
}

function Solution() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>Exercise 4: Custom Hooks Solution</h2>

      {/* The Solution */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#e6ffe6', 
        borderRadius: '5px' 
      }}>
        <h3>✅ Solution: useFetch Custom Hook</h3>
        <pre style={{ 
          backgroundColor: '#fff', 
          padding: '15px', 
          borderRadius: '5px', 
          overflow: 'auto',
          fontSize: '13px'
        }}>
{`function useFetch(fetchFunction, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await fetchFunction();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => { cancelled = true; };
  }, dependencies);

  return { data, loading, error };
}`}
        </pre>
      </div>

      {/* Live Examples */}
      <div style={{ marginBottom: '20px' }}>
        <h3>🎯 Live Examples Using Custom Hook</h3>
        <UserProfile />
        <PostsList />
        <CommentsList />
      </div>

      {/* Usage Example */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#e6f3ff', 
        borderRadius: '5px' 
      }}>
        <h3>💡 How to Use</h3>
        <pre style={{ 
          backgroundColor: '#fff', 
          padding: '15px', 
          borderRadius: '5px', 
          overflow: 'auto',
          fontSize: '13px'
        }}>
{`// Define your fetch function
const fetchUser = () => {
  return fetch('/api/user').then(res => res.json());
};

// Use the custom hook in your component
function UserProfile() {
  const { data, loading, error } = useFetch(fetchUser, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{data.name}</div>;
}`}
        </pre>
      </div>

      {/* Key Takeaways */}
      <div style={{ 
        padding: '15px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '5px',
        marginBottom: '20px'
      }}>
        <h3>📚 Key Takeaways</h3>
        <ol>
          <li><strong>Custom hooks extract reusable logic:</strong> Share stateful logic between components</li>
          <li><strong>Naming convention:</strong> Always start with "use" prefix (e.g., useFetch, useForm)</li>
          <li><strong>Can use other hooks:</strong> useState, useEffect, useContext, etc.</li>
          <li><strong>Return what components need:</strong> Usually an object or array of values</li>
          <li><strong>Cleanup is important:</strong> Prevent memory leaks with cleanup functions</li>
          <li><strong>Dependencies matter:</strong> Pass dependencies to control when hook re-runs</li>
          <li><strong>Testable:</strong> Custom hooks can be tested independently</li>
        </ol>
      </div>

      {/* Before vs After */}
      <div style={{ 
        padding: '15px', 
        backgroundColor: '#fff3cd', 
        borderRadius: '5px',
        marginBottom: '20px'
      }}>
        <h3>📊 Before vs After Comparison</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#ffc107' }}>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Aspect</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Before (Duplicated)</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>After (Custom Hook)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}><strong>Code Lines</strong></td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>~30 lines per component</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>~5 lines per component</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}><strong>Maintainability</strong></td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>❌ Update in multiple places</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>✅ Update in one place</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}><strong>Testability</strong></td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>❌ Test each component</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>✅ Test hook once</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}><strong>Reusability</strong></td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>❌ Copy-paste code</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>✅ Import and use</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}><strong>Bug Fixes</strong></td>
              <td style={{ padding: '10px', border: '1px 
```

### Core Architecture Module: `coding-exercise/src/exercises/exercise-04-custom-hooks/index.js`
```
export { default as Problem } from './Problem';
export { default as Solution } from './Solution';

```

### Core Architecture Module: `coding-exercise/src/serviceWorker.js`
```
// This optional code is used to register a service worker.
// register() is not called by default.

// This lets the app load faster on subsequent visits in production, and gives
// it offline capabilities. However, it also means that developers (and users)
// will only see deployed updates on subsequent visits to a page, after all the
// existing tabs open on the page have been closed, since previously cached
// resources are updated in the background.

// To learn more about the benefits of this model and instructions on how to
// opt-in, read https://bit.ly/CRA-PWA

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 are considered localhost for IPv4.
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Our service worker won't work if PUBLIC_URL is on a different origin
      // from what our page is served on. This might happen if a CDN is used to
      // serve assets; see https://github.com/facebook/create-react-app/issues/2374
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        // This is running on localhost. Let's check if a service worker still exists or not.
        checkValidServiceWorker(swUrl, config);

        // Add some additional logging to localhost, pointing developers to the
        // service worker/PWA documentation.
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service ' +
              'worker. To learn more, visit https://bit.ly/CRA-PWA'
          );
        });
      } else {
        // Is not localhost. Just register service worker
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              console.log(
                'New content is available and will be used when all ' +
                  'tabs for this page are closed. See https://bit.ly/CRA-PWA.'
              );

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // At this point, everything has been precached.
              // It's the perfect time to display a
              // "Content is cached for offline use." message.
              console.log('Content is cached for offline use.');

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch(error => {
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then(response => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log(
        'No internet connection found. App is running in offline mode.'
      );
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}

```

### Core Architecture Module: `coding-hooks/src/App.tsx`
```
import { useState } from "react";

import Previous from "./hooks/01-usePrevious/App";
import Debounce from "./hooks/02-useDebounce/App";
import DebounceCallback from "./hooks/03-useDebounceCallback/App";
import Toggle from "./hooks/04-useToggle/App";
import Interval from "./hooks/05-useInterval/App";
import LocalStorage from "./hooks/06-useLocalStorage/App";
import Fetch from "./hooks/07-useFetch/App";

export default function App() {
  const [question, setQuestion] = useState(1);

  return (
    <div>
      <h1>Senior React Hooks</h1>

      <div>
        <button onClick={() => setQuestion(1)}>
          01 Previous
        </button>

        <button onClick={() => setQuestion(2)}>
          02 Debounce
        </button>

        <button onClick={() => setQuestion(3)}>
          03 DebounceCallback
        </button>

        <button onClick={() => setQuestion(4)}>
          04 Toggle
        </button>

        <button onClick={() => setQuestion(5)}>
          05 Interval
        </button>

        <button onClick={() => setQuestion(6)}>
          06 LocalStorage
        </button>

        <button onClick={() => setQuestion(7)}>
          07 Fetch
        </button>
      </div>

      <hr />

      {question === 1 && <Previous />}
      {question === 2 && <Debounce />}
      {question === 3 && <DebounceCallback />}
      {question === 4 && <Toggle />}
      {question === 5 && <Interval />}
      {question === 6 && <LocalStorage />}
      {question === 7 && <Fetch />}
    </div>
  );
}

```

### Core Architecture Module: `coding-hooks/src/hooks/01-usePrevious/App.tsx`
```
import { useState } from "react";
import { usePrevious } from "./usePrevious";

export default function App() {
    const [count, setCount] = useState<number>(0);
    const previous = usePrevious(count);

    return (
        <div>
            <h2>usePrevious hook</h2>

            <span>Current: {count}</span>
            <span>Previous: {previous}</span>

            <button onClick={() => setCount(count => count+1)}>Increment</button>
        </div>
    );
}
```

### Core Architecture Module: `coding-hooks/src/hooks/01-usePrevious/usePrevious.ts`
```
import { useRef, useEffect } from "react";

export function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref.current;
}


```

### Core Architecture Module: `coding-hooks/src/hooks/02-useDebounce/App.tsx`
```
import { useState } from "react";
import { useDebounce } from "./useDebounce";

export default function App() {
    const [search, setSearch] = useState("");

    const debouncedSearch = useDebounce(search, 500);

    return (
        <div>
            <h2>useDebounce hook</h2>

            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} />

            <p>Typing: {search}</p>
            <p>Debounced value: {debouncedSearch}</p>
        </div>
    )
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #408** (2026-09-23): **docs: update React Router answers from v4 to v6**
  *Symptoms*: Closes #313  Questions 82–89 and 172 documented React Router **v4** syntax. Much of that API no longer exists in v6 — `<Switch>`, `withRouter`, `<Redirect>` and the exposed `history` object were all removed — so a reader copying these answers into an interview would be describing APIs that are gone.  ### Changes  | Q | Was (v4/v5) | Now (v6) | |---|---|---| | 82 | `history.push()` / `history.replace()` | `navigate(path)` / `navigate(path, { replace: true })` | | 83 | `withRouter`, `<Route>` render props, `contextTypes` | `useNavigate` | | 84 | `query-string` / raw `URLSearchParams` | `useSearchParams` | | 85 | `<Switch>` wrapper | `<Routes>` — the warning no longer exists in v6 | | 86 | `history.push({ pathname, search, state })` | `navigate(path, { state })` + `useLocation` | | 87 | pathless `<Route component={NotFound} />` | `<Route path="*" element={...} />` | | 88 | shared custom `history` module | `useNavigate`, or `createBrowserRouter` + `router.navigate` for use outside the tree | | 89 | `<Redirect to="..." />` | `<Navigate to="..." replace />` | | 172 | "benefits of React Router v4" | kept as historical, with a v4 → v6 migration summary |  Q83's three v4 approaches are listed explicitly as **removed**, with the hook that replaces each — that mapping is what tends to get asked about in interviews. Q85 and Q87 also note the behavioural change: `<Routes>` picks the *best* match rather than the first, so `exact` and route ordering are no longer needed.  Where a v4 concept

- **Issue #407** (2026-09-23): **fix: correct bugs in coding exercises and practice apps**
  *Symptoms*: Fixes compile errors, logic bugs, and missing link hardening across `coding-hooks/` and `coding-projects/`.  ### Compile errors (these currently break `tsc -b`)  - **`useThrottle`** — the hook had no React imports at all; it also subtracted the *ref object* rather than `.current` (making `remaining` always `NaN`) and assigned to a `const` ref. Added imports, fixed `.current` on reads and writes, and added `clearTimeout` cleanup. - **`useThrottle` demo** — `useState` was used without being imported, and `useEffect` was passed a number instead of a dependency array. - **`useDebounceCallback`** — removed a stray `import { time } from "node:console"` that cannot resolve in a browser bundle and was unused. - Wired the `useThrottle` demo into the hooks switcher, where it was missing.  ### Logic fixes  - **Modal** — the Escape handler was registered on `click`, so `event.key` was never defined and Escape never closed the modal. Now on `keydown`. - **data-table** — the loading and error blocks were bare statements in the function body rather than JSX in the returned tree, so they never rendered (fetch failures were invisible). Search also lowercased the query but compared against unlowercased fields, so it never matched. - **shopping-cart** — decrementing could take quantity to 0 and below; the guard was only on the button, not in the state updater. - **infinite-scroll** — `fetchPosts` already accepted an `AbortSignal` but none was passed; added an `AbortController` and ignore `Abort

- **Issue #406** (2026-09-23): **docs: update deprecated React APIs for React 19**
  *Symptoms*: Several answers still present APIs that were **removed in React 19** as if they were current, which can mislead readers preparing for interviews.  ### Changes  - **`ReactDOM.render()`** → `createRoot().render()` from `react-dom/client` across 14 code samples. The dedicated Q&A documenting the old `ReactDOM.render(element, container, [callback])` signature now notes the removal and that the `callback` argument was already dropped in React 18. - **`unmountComponentAtNode()`** → documented as removed, with `root.unmount()` shown as the replacement. - **`findDOMNode()`** → noted as deprecated in 16.6 and removed in 19. - **`defaultProps` on function components** → noted as removed in React 19 (still valid on classes), with the ES6 default-parameter replacement shown. - **`React.createClass()`** → the two unannotated samples updated; `getInitialState`, `statics`, and `displayName` sections annotated. - **`unstable_ConcurrentMode` / `unstable_createRoot`** → noted as never having shipped stably, superseded by `createRoot` in React 18. - **Legacy lifecycles** (`componentWillMount`, `componentWillReceiveProps`, `componentWillUpdate`) → `UNSAFE_` prefix and StrictMode warnings noted where missing. - **String refs** → corrected a factual error: they were removed in **React 19**, not React 16 as previously stated. - **Version history** → added a React 19 entry to the timeline. - **Google Analytics** → sample migrated from Universal Analytics (`window.ga`, sunset July 2023) to GA4 `gtag`

- **Issue #405** (2026-09-14): **fix: correct bugs in coding exercises and practice apps**
  *Symptoms*: Fixes compile errors, logic bugs, and missing link hardening across `coding-hooks/` and `coding-projects/`.  ### Compile errors (these currently break `tsc -b`)  - **`useThrottle`** — the hook had no React imports at all; it also subtracted the *ref object* rather than `.current` (making `remaining` always `NaN`) and assigned to a `const` ref. Added imports, fixed `.current` on reads and writes, and added `clearTimeout` cleanup. - **`useThrottle` demo** — `useState` was used without being imported, and `useEffect` was passed a number instead of a dependency array. - **`useDebounceCallback`** — removed a stray `import { time } from "node:console"` that cannot resolve in a browser bundle and was unused. - Wired the `useThrottle` demo into the hooks switcher, where it was missing.  ### Logic fixes  - **Modal** — the Escape handler was registered on `click`, so `event.key` was never defined and Escape never closed the modal. Now on `keydown`. - **data-table** — the loading and error blocks were bare statements in the function body rather than JSX in the returned tree, so they never rendered (fetch failures were invisible). Search also lowercased the query but compared against unlowercased fields, so it never matched. - **shopping-cart** — decrementing could take quantity to 0 and below; the guard was only on the button, not in the state updater. - **infinite-scroll** — `fetchPosts` already accepted an `AbortSignal` but none was passed; added an `AbortController` and ignore `Abort

- **Issue #404** (2026-09-14): **docs: update deprecated React APIs for React 19**
  *Symptoms*: Several answers still present APIs that were **removed in React 19** as if they were current, which can mislead readers preparing for interviews.  ### Changes  - **`ReactDOM.render()`** → `createRoot().render()` from `react-dom/client` across 14 code samples. The dedicated Q&A documenting the old `ReactDOM.render(element, container, [callback])` signature now notes the removal and that the `callback` argument was already dropped in React 18. - **`unmountComponentAtNode()`** → documented as removed, with `root.unmount()` shown as the replacement. - **`findDOMNode()`** → noted as deprecated in 16.6 and removed in 19. - **`defaultProps` on function components** → noted as removed in React 19 (still valid on classes), with the ES6 default-parameter replacement shown. - **`React.createClass()`** → the two unannotated samples updated; `getInitialState`, `statics`, and `displayName` sections annotated. - **`unstable_ConcurrentMode` / `unstable_createRoot`** → noted as never having shipped stably, superseded by `createRoot` in React 18. - **Legacy lifecycles** (`componentWillMount`, `componentWillReceiveProps`, `componentWillUpdate`) → `UNSAFE_` prefix and StrictMode warnings noted where missing. - **String refs** → corrected a factual error: they were removed in **React 19**, not React 16 as previously stated. - **Version history** → added a React 19 entry to the timeline. - **Google Analytics** → sample migrated from Universal Analytics (`window.ga`, sunset July 2023) to GA4 `gtag`

- **Issue #401** (2026-08-30): **Bump js-yaml from 3.13.1 to 3.15.1 in /coding-exercise**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 3.13.1 to 3.15.1. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/3.15.1/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>3.15.1 - 2026-07-31</h2> <h3>Security</h3> <ul> <li>[backport] Remove quadratic complexity from <code>!!omap</code> duplicate key detection.</li> </ul> <h2>3.15.0 - 2026-06-27</h2> <h3>Added</h3> <ul> <li>Added <code>maxTotalMergeKeys</code> (10000) loader option to limit the total number of keys processed by YAML merge (<code>&lt;&lt;</code>) across one <code>safeLoad()</code> / <code>safeLoadAll()</code> call.</li> </ul> <h2>[3.14.2] - 2025-11-15</h2> <h3>Security</h3> <ul> <li>Fix prototype pollution in merge (&lt;&lt;).</li> </ul> <h2>[3.14.1] - 2020-12-07</h2> <h3>Security</h3> <ul> <li>Fix possible code execution in (already unsafe) <code>.load()</code> (in &amp;anchor).</li> </ul> <h2>[3.14.0] - 2020-05-22</h2> <h3>Changed</h3> <ul> <li>Support <code>safe/loadAll(input, options)</code> variant of call.</li> <li>CI: drop outdated nodejs versions.</li> <li>Dev deps bump.</li> </ul> <h3>Fixed</h3> <ul> <li>Quote <code>=</code> in plain scalars <a href="https://redirect.github.com/nodeca/js-yaml/issues/519">#519</a>.</li> <li>Check the node type for <code>!&lt;?&gt;</code> tag in case user manually specifies it.</li> <li>Verify that there are no null-bytes in input.</li> <li>Fix wrong quote position when writing condensed fl
  **Post-Mortem & Fix Analysis**:
  > Looks like js-yaml is no longer updatable, so this is no longer needed.

- **Issue #398** (2026-08-30): **Bump brace-expansion from 1.1.11 to 1.1.18 in /coding-exercise**
  *Symptoms*: Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.11 to 1.1.18. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/juliangruber/brace-expansion/releases">brace-expansion's releases</a>.</em></p> <blockquote> <h2>v1.1.15</h2> <ul> <li>Backport v5.0.6 change to v1 (<a href="https://redirect.github.com/juliangruber/brace-expansion/issues/111">#111</a>)  0b09384</li> </ul> <hr /> <p><a href="https://github.com/juliangruber/brace-expansion/compare/v1.1.14...v1.1.15">https://github.com/juliangruber/brace-expansion/compare/v1.1.14...v1.1.15</a></p> <h2>v1.1.12</h2> <ul> <li>pkg: publish on tag 1.x  c460dbd</li> <li>fmt  ccb8ac6</li> <li>Fix potential ReDoS Vulnerability or Inefficient Regular Expression (<a href="https://redirect.github.com/juliangruber/brace-expansion/issues/65">#65</a>)  c3c73c8</li> </ul> <hr /> <p><a href="https://github.com/juliangruber/brace-expansion/compare/v1.1.11...v1.1.12">https://github.com/juliangruber/brace-expansion/compare/v1.1.11...v1.1.12</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li>See full diff in <a href="https://github.com/juliangruber/brace-expansion/commits">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=brace-expansion&package-manager=npm_and_yarn&previous-version=1.1.11&new-version=1.1.18)](https://docs.github.com/en/gi
  **Post-Mortem & Fix Analysis**:
  > Looks like brace-expansion is no longer updatable, so this is no longer needed.

- **Issue #397** (2026-08-10): **Bump js-yaml from 3.13.1 to 3.15.0 in /coding-exercise**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 3.13.1 to 3.15.0. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>4.3.0, 3.15.0 - 2026-06-27</h2> <h3>Security</h3> <ul> <li>Backported <code>maxTotalMergeKeys</code> option.</li> </ul> <h2>[5.2.0] - 2026-06-26</h2> <h3>Added</h3> <ul> <li>Added <code>maxTotalMergeKeys</code> (10000) loader option to limit the total number of keys processed by YAML merge (<code>&lt;&lt;</code>) across one <code>load()</code> / <code>loadAll()</code> call.</li> <li>Added <code>maxAliases</code> (-1) loader option to limit the number of YAML aliases per document.</li> </ul> <h3>Removed</h3> <ul> <li><code>maxMergeSeqLength</code> replaced with <code>maxTotalMergeKeys</code> for limiting YAML merge processing.</li> </ul> <h3>Fixed</h3> <ul> <li>Round-trip of integers with exponential form (&gt;= <code>1e21</code>)</li> </ul> <h2>[5.1.0] - 2026-06-23</h2> <h3>Added</h3> <ul> <li>Collection tags can finalize an incrementally populated carrier into a different result value.</li> </ul> <h3>Changed</h3> <ul> <li>[breaking] <code>quoteStyle</code> now selects the preferred quote style; use the restored <code>forceQuotes</code> option to force quoting non-key strings.</li> </ul> <h2>[5.0.0] - 2026-06-20</h2> <h3>Added</h3> <ul> <li>Added named exports for schemas, tags, parser events and AST utilities.</li> <li>Reworke
  **Post-Mortem & Fix Analysis**:
  > Superseded by #401.

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

### Incident Patch 1: `55b7d491` (2026-08-31)
**Commit Message**: Added redux questions

**File**: `README.md` (modified, +908/-0)
```diff
@@ -387,6 +387,31 @@ Hide/Show table of contents
 | 329 | [What is the difference between HOCs and Hooks?](#what-is-the-difference-between-hocs-and-hooks)                                                                                                                                 |
 | 330 | [Does `React.memo` prevent Context consumers from re-rendering?](#does-reactmemo-prevent-context-consumers-from-re-rendering)                                                                                                    |
 | 331 | [How would you create a reusable Context?](#how-would-you-create-a-reusable-context)                                                                                                                                             |
+| 332 | [Why is Redux Toolkit recommended over Redux?](#why-is-redux-toolkit-recommended-over-redux)                                                                                                                                     |
+| 333 | [What is the difference between client state and server state?](#what-is-the-difference-between-client-state-and-server-state)                                                                                                   |
+| 334 | [How do you prevent unnecessary Redux re-renders?](#how-do-you-prevent-unnecessary-redux-re-renders)                                                                                                                             |
+| 335 | [What is `createSelector`?](#what-is-createselector)                                                                                                                                                                              |
+| 336 | [What is normalized Redux state?](#what-is-normalized-redux-state)                                                                                                                                                                 |
+| 337 | [Why is normalized state important for performance?](#why-is-normalized-state-important-for-performance)                                                                                                                         |
+| 338 | [What is Redux middleware?](#what-is-redux-middleware)                                                                                                                                                                            |
+| 339 | [What is the Redux middleware signature?](#what-is-the-redux-middleware-signature)                                                                                                                                                |
+| 340 | [What happens when you dispatch an action?](#what-happens-when-you-dispatch-an-action)                                                                                                                                           |
+| 341 | [How would you structure Redux in a large application?](#how-would-you-structure-redux-in-a-large-application)                                                                                                                   |
+| 342 | [How do you handle cross-slice communication?](#how-do-you-handle-cross-slice-communication)                                                                                                                                     |
+| 343 | [What are Redux serializable values?](#what-are-redux-serializable-values)                                                                                                                                                       |
+| 344 | [How do you handle race conditions in Redux?](#how-do-you-handle-race-conditions-in-redux)                                                                                                                                       |
+| 345 | [How do you persist Redux state?](#how-do-you-persist-redux-state)                                                                                                                                                               |
+| 346 | [How do you debug a Redux performance problem?](#how-do-you-debug-a-redux-performance-problem)                                                                                                                                   |
+| 347 | [What should be stored in Redux vs derived with selectors?](#what-should-be-stored-in-redux-vs-derived-with-selectors)                                                                                                           |
+| 348 | [Would you put all API data into Redux?](#would-you-put-all-api-data-into-redux)                                                                                                                                                 |
+| 349 | [What is the difference between BrowserRouter, HashRouter, and MemoryRouter?](#what-is-the-difference-between-browserrouter-hashrouter-and-memoryrouter)                                                                 
```

---

### Incident Patch 2: `f66aae9c` (2025-12-14)
**Commit Message**: Merge pull request #381 from aacismaharjan/issue#253_fix_react_automatic_batching_example

fix: correct event handler name in React batching example

**File**: `README.md` (modified, +1/-1)
```diff
@@ -5988,7 +5988,7 @@ class ParentComponent extends React.Component {
 
         console.log("Application Rendered");
 
-        const handleUsers = () => {
+        const handleAsyncFetch = () => {
           fetch("https://jsonplaceholder.typicode.com/users/1").then(() => {
             // Automatic Batching re-render only once
             setCount(count + 1);
```

---

### Incident Patch 3: `91f42ed8` (2025-12-13)
**Commit Message**: fix: correct event handler name in React batching example

**File**: `README.md` (modified, +1/-1)
```diff
@@ -5988,7 +5988,7 @@ class ParentComponent extends React.Component {
 
         console.log("Application Rendered");
 
-        const handleUsers = () => {
+        const handleAsyncFetch = () => {
           fetch("https://jsonplaceholder.typicode.com/users/1").then(() => {
             // Automatic Batching re-render only once
             setCount(count + 1);
```

---

### Incident Patch 4: `5180d688` (2025-10-30)
**Commit Message**: Merge pull request #368 from codomposer/fix/coding_exercise

fix syntax error in coding exercise #3

**File**: `coding-exercise/README.md` (modified, +8/-7)
```diff
@@ -105,13 +105,14 @@ export default function Counter() {
     countRef.current = countRef.current + 1;
   }
 
-  return;
-  <>
-    <span>Count: {countRef.current}</span>
-    <button onClick={handleIncrement}>
-      Click me
-    </button>
-  </>
+  return (
+    <>
+      <span>Count: {countRef.current}</span>
+      <button onClick={handleIncrement}>
+        Click me
+      </button>
+    </>
+  )
 }
 ```
 
```

---

### Incident Patch 5: `35fbcde8` (2025-10-30)
**Commit Message**: Fixed syntax error in coding exercise

**File**: `coding-exercise/README.md` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ export default function Counter() {
     countRef.current = countRef.current + 1;
   }
 
-  return 
+  return;
   <>
     <span>Count: {countRef.current}</span>
     <button onClick={handleIncrement}>
```

---

### Incident Patch 6: `3c91f196` (2025-10-29)
**Commit Message**: Merge pull request #370 from codomposer/fix/coding_exercise#5

fix string concatenation in coding exercise #5

**File**: `coding-exercise/README.md` (modified, +4/-4)
```diff
@@ -202,10 +202,10 @@ export default function Counter() {
 
   return (
     <>
-		<div>Clicked + {ref.current} + times</div>
-		<button onClick={handleClick}>
-			Click me!
-		</button>
+      <div>Clicked {ref.current} times</div>
+      <button onClick={handleClick}>
+        Click me!
+      </button>
     </>
   );
 }
```

---

### Incident Patch 7: `fdf617af` (2025-10-29)
**Commit Message**: fix string concatenation in coding exercise #5

**File**: `coding-exercise/README.md` (modified, +4/-4)
```diff
@@ -202,10 +202,10 @@ export default function Counter() {
 
   return (
     <>
-		<div>Clicked + {ref.current} + times</div>
-		<button onClick={handleClick}>
-			Click me!
-		</button>
+      <div>Clicked {ref.current} times</div>
+      <button onClick={handleClick}>
+        Click me!
+      </button>
     </>
   );
 }
```

---

### Incident Patch 8: `99fbd5fd` (2025-10-29)
**Commit Message**: fix syntax error in coding exercise

**File**: `coding-exercise/README.md` (modified, +8/-7)
```diff
@@ -105,13 +105,14 @@ export default function Counter() {
     countRef.current = countRef.current + 1;
   }
 
-  return 
-  <>
-    <span>Count: {countRef.current}</span>
-    <button onClick={handleIncrement}>
-      Click me
-    </button>
-  </>
+  return (
+    <>
+      <span>Count: {countRef.current}</span>
+      <button onClick={handleIncrement}>
+        Click me
+      </button>
+    </>
+  )
 }
 ```
 
```

---

### Incident Patch 9: `da89975c` (2025-06-28)
**Commit Message**: Improve redux vs flux

**File**: `README.md` (modified, +9/-4)
```diff
@@ -1082,6 +1082,7 @@ class ParentComponent extends React.Component {
 17. ### How Virtual DOM works?
 
     The _Virtual DOM_ works in five simple steps.
+
     **1. Initial Render**  
         When a UI component renders for the first time, it returns JSX. React uses this structure to create a Virtual DOM tree, which is a lightweight copy of the actual DOM. This Virtual DOM is then used to build and render the Real DOM in the browser.
 
@@ -3208,11 +3209,15 @@ class ParentComponent extends React.Component {
 
 105. ### What are the downsides of Redux compared to Flux?
 
-     Instead of saying downsides we can say that there are few compromises of using Redux over Flux. Those are as follows:
+     While Redux offers a powerful and predictable state management solution, it comes with a few trade-offs when compared to Flux. These include:
+
+     1.  **Immutability is essential**  
+        Redux enforces a strict immutability model for state updates, which differs from Flux’s more relaxed approach. This means you must avoid mutating state directly. Many Redux-related libraries assume immutability, so your team must be disciplined in writing pure update logic. You can use tools like `redux-immutable-state-invariant`, `Immer`, or `Immutable.js` to help enforce this practice, especially during development.
+     2.  **Careful selection of complementary packages**  
+        Redux is more minimal by design and provides extension points such as middleware and store enhancers. This has led to a large ecosystem, but it also means you must thoughtfully choose and configure additional packages for features like undo/redo, persistence, or form handling—something Flux explicitly leaves out but may be simpler to manage in smaller setups.
+     3.  **Limited static type integration**  
+        While Flux has mature support for static type checking with tools like Flow, Redux’s type integration is less seamless. Although TypeScript is commonly used with Redux now, early Flow support was limited, and more boilerplate was required for static type safety. This may affect teams that rely heavily on type systems for large codebases.
 
-     1. **You will need to learn to avoid mutations:** Flux is un-opinionated about mutating data, but Redux doesn't like mutations and many packages complementary to Redux assume you never mutate the state. You can enforce this with dev-only packages like `redux-immutable-state-invariant`, Immutable.js, or instructing your team to write non-mutating code.
-     2. **You're going to have to carefully pick your packages:** While Flux explicitly doesn't try to solve problems such as undo/redo, persistence, or forms, Redux has extension points such as middleware and store enhancers, and it has spawned a rich ecosystem.
-     3. **There is no nice Flow integration yet:** Flux currently lets you do very impressive static type checks which Redux doesn't support yet.
 
 **[⬆ Back to Top](#table-of-contents)**
 
```

---

### Incident Patch 10: `2b9f8d5b` (2025-06-20)
**Commit Message**: Add redux questions

**File**: `README.md` (modified, +47/-7)
```diff
@@ -2994,17 +2994,36 @@ class ParentComponent extends React.Component {
 
 102. ### What is flux?
 
-     _Flux_ is an _application design paradigm_ used as a replacement for the more traditional MVC pattern. It is not a framework or a library but a new kind of architecture that complements React and the concept of Unidirectional Data Flow. Facebook uses this pattern internally when working with React.
+       **Flux** is an **application architecture** (not a framework or library) designed by Facebook to manage **data flow** in React applications. It was created as an alternative to the traditional **MVC (Model-View-Controller)** pattern, and it emphasizes a **unidirectional data flow** to make state changes more predictable and easier to debug.
 
-     The workflow between dispatcher, stores and views components with distinct inputs and outputs as follows:
+       Flux complements React by organizing the way data moves through your application, especially in large-scale or complex projects.
 
-     ![flux](images/flux.png)
+       #### Core Concepts of Flux
 
-**[⬆ Back to Top](#table-of-contents)**
+       Flux operates using **four key components**, each with a specific responsibility:
+       *   **Actions**
+             *   Plain JavaScript objects or functions that describe _what happened_ (e.g., user interactions or API responses).
+             *   Example: `{ type: 'ADD_TODO', payload: 'Buy milk' }`
+       *   **Dispatcher**
+             *   A central hub that receives actions and **dispatches** them to the appropriate stores.
+             *   There is **only one dispatcher** in a Flux application.
+       *   **Stores**
+             *   Hold the **application state** and business logic.
+             *   Respond to actions from the dispatcher and update themselves accordingly.
+             *   They **emit change events** that views can listen to.
+       *   **Views (React Components)**
+             *   Subscribe to stores and **re-render** when the data changes.
+             *   They can also trigger new actions (e.g., on user input).
+
+
+       The workflow between dispatcher, stores and views components with distinct inputs and outputs as follows:
+
+       ![flux](images/flux.png)
 
-103. ### What is Redux?
+**[⬆ Back to Top](#table-of-contents)**
 
-     _Redux_ is a predictable state container for JavaScript apps based on the _Flux design pattern_. Redux can be used together with React, or with any other view library. It is tiny (about 2kB) and has no dependencies.
+103.  ### What is Redux?
+       Redux is a predictable state container for JavaScript applications, most commonly used with React. It helps you manage and centralize your application’s state in a single source of truth, enabling easier debugging, testing, and maintenance—especially in large or complex applications. Redux core is tiny library(about 2.5kB gzipped) and has no dependencies.
 
 **[⬆ Back to Top](#table-of-contents)**
 
@@ -3013,8 +3032,29 @@ class ParentComponent extends React.Component {
      Redux follows three fundamental principles:
 
      1. **Single source of truth:** The state of your whole application is stored in an object tree within a single store. The single state tree makes it easier to keep track of changes over time and debug or inspect the application.
+   
+      ```jsx
+      const store = createStore(reducer);
+      ```
      2. **State is read-only:** The only way to change the state is to emit an action, an object describing what happened. This ensures that neither the views nor the network callbacks will ever write directly to the state.
-     3. **Changes are made with pure functions:** To specify how the state tree is transformed by actions, you write reducers. Reducers are just pure functions that take the previous state and an action as parameters, and return the next state.
+      ```js
+      const action = { type: 'INCREMENT' };
+      store.dispatch(action);
+      ```
+     3. **Changes are made with pure functions(Reducers):** To specify how the state tree is transformed by actions, you write reducers. Reducers are just pure functions that take the previous state and an action as parameters, and return the next state.
+      
+      ```jsx
+      function counter(state = 0, action) {
+        switch (action.type) {
+          case 'INCREMENT':
+            return state + 1;
+          case 'DECREMENT':
+            return state - 1;
+          default:
+            return state;
+        }
+      }
+      ```
 
 **[⬆ Back to Top](#table-of-contents)**
 
```

---

### Incident Patch 11: `bd14a880` (2025-06-16)
**Commit Message**: Fix formatting related to folder structure query

**File**: `README.md` (modified, +4/-6)
```diff
@@ -2348,8 +2348,6 @@ class ParentComponent extends React.Component {
 
 74. ### Is it possible to use async/await in plain React?
 
-    # Can You Use async/await in Plain React?
-
     Yes, you can use `async/await` in plain React, as long as your JavaScript environment supports ES2017+. Nowadays most modern browsers and build tools support ES2017+ version. If you're using **Create React App**, **Next.js**, **Remix**, or any modern React setup, `async/await` is supported out of the box through **Babel**.
 
     ### Example Usage
@@ -2377,11 +2375,11 @@ class ParentComponent extends React.Component {
 
 **[⬆ Back to Top](#table-of-contents)**
 
-75.   ### What are the common folder structures for React?
+75.  ### What are the common folder structures for React?
 
-    There are two common practices for React project file structure.
+     There are two common practices for React project file structure.
 
-    1.  **Grouping by features or routes:**
+     1.  **Grouping by features or routes:**
 
         One common way to structure projects is locate CSS, JS, and tests together, grouped by feature or route.
 
@@ -2406,7 +2404,7 @@ class ParentComponent extends React.Component {
         └─ ProfileAPI.js
         ```
 
-    2.  **Grouping by file type:**
+     2.  **Grouping by file type:**
 
         Another popular way to structure projects is to group similar files together.
 
```

---

### Incident Patch 12: `996dc37d` (2025-05-13)
**Commit Message**: Merge pull request #352 from kenshanta/fix-67-subtitle-typo

docs: update subtitle #67 to match content

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2087,7 +2087,7 @@ class ParentComponent extends React.Component {
 
 **[⬆ Back to Top](#table-of-contents)**
 
-67. ### Why you can't update props in React?
+67. ### Why can't you update props in React?
 
     The React philosophy is that props should be _immutable_(read only) and _top-down_. This means that a parent can send any prop values to a child, but the child can't modify received props.
 
```

---

### Incident Patch 13: `8eb4b010` (2025-03-31)
**Commit Message**: Merge pull request #349 from waiz3ple/grammar-fix

Doc: Fix grammatical inconsistencies



---

### Incident Patch 14: `67d36c84` (2025-03-03)
**Commit Message**: Doc: Fix grammatical inconsistencies



#### Recent Merged Pull Requests:
- **PR #408** (closed): docs: update React Router answers from v4 to v6 (@Faizankhan17623)
- **PR #407** (closed): fix: correct bugs in coding exercises and practice apps (@Faizankhan17623)
- **PR #406** (closed): docs: update deprecated React APIs for React 19 (@Faizankhan17623)
- **PR #405** (closed): fix: correct bugs in coding exercises and practice apps (@Faizankhan17623)
- **PR #404** (closed): docs: update deprecated React APIs for React 19 (@Faizankhan17623)
- **PR #401** (closed): Bump js-yaml from 3.13.1 to 3.15.1 in /coding-exercise (@dependabot[bot])
- **PR #398** (closed): Bump brace-expansion from 1.1.11 to 1.1.18 in /coding-exercise (@dependabot[bot])
- **PR #397** (closed): Bump js-yaml from 3.13.1 to 3.15.0 in /coding-exercise (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
