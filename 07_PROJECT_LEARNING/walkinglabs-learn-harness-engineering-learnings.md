# Forensic Learning Record (Deep Inspection): walkinglabs/learn-harness-engineering

> **Canonical Artifact**: `07_PROJECT_LEARNING/walkinglabs-learn-harness-engineering-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:19:18.043Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `walkinglabs/learn-harness-engineering`
- **Description**: Harness engineering beginner tutorial, from 0 to 1
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 19323 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `projects/project-01/solution/src/renderer/App.tsx`
```
import { useState, useCallback } from 'react';
import { DocumentList } from './components/DocumentList';
import { QuestionPanel } from './components/QuestionPanel';
import { DocumentDetail } from './components/DocumentDetail';
import { StatusBar } from './components/StatusBar';
import { Document, AppStatus, QAResponse } from '../shared/types';

declare global {
  interface Window {
    knowledgeBase: {
      documents: {
        list: () => Promise<Document[]>;
        import: (filePath: string) => Promise<Document>;
        get: (id: string) => Promise<Document | null>;
        delete: (id: string) => Promise<boolean>;
      };
      indexing: {
        start: (documentId?: string) => Promise<{ status: string }>;
        status: () => Promise<AppStatus>;
        chunks: (documentId: string) => Promise<Array<{ id: string; content: string; index: number }>>;
      };
      qa: {
        ask: (question: string) => Promise<QAResponse>;
        history: () => Promise<Array<{ question: string; response: QAResponse }>>;
      };
    };
  }
}

export function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>({
    documentsLoaded: 0,
    indexStatus: 'idle',
    lastActivity: '',
  });
  const [lastResponse, setLastResponse] = useState<QAResponse | null>(null);

  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await window.knowledgeBase.documents.list();
      setDocuments(docs);
      const status = await window.knowledgeBase.indexing.status();
      setAppStatus(status);
    } catch (err) {
      console.error('Failed to refresh documents:', err);
    }
  }, []);

  const handleImport = useCallback(async () => {
    // In a real app this would open a file dialog.
    // For the course, we'll trigger import via the dev console or init script.
    console.log('Import triggered - use window.knowledgeBase.documents.import(filePath)');
  }, []);

  const handleSelectDocument = useCallback((doc: Document) => {
    setSelectedDoc(doc);
  }, []);

  const handleAskQuestion = useCallback(async (question: string) => {
    try {
      const response = await window.knowledgeBase.qa.ask(question);
      setLastResponse(response);
    } catch (err) {
      console.error('Q&A failed:', err);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{
        padding: '12px 20px',
        background: '#16213e',
        borderBottom: '1px solid #0f3460',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Knowledge Base</h1>
        <button
          onClick={refreshDocuments}
          style={{
            padding: '6px 14px',
            background: '#0f3460',
            color: '#e0e0e0',
            border: '1px solid #1a1a4e',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Refresh
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel: Document list */}
        <div style={{
          width: '280px',
          borderRight: '1px solid #0f3460',
          display: 'flex',
          flexDirection: 'column',
          background: '#16213e',
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid #0f3460',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#a0a0c0' }}>
              Documents ({documents.length})
            </span>
            <button
              onClick={handleImport}
              style={{
                padding: '4px 10px',
                background: '#533483',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              + Import
            </button>
          </div>
          <DocumentList
            documents={documents}
            onSelect={handleSelectDocument}
            selectedId={selectedDoc?.id ?? null}
          />
        </div>

        {/* Right panel: Document detail + Q&A */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {selectedDoc ? (
              <DocumentDetail document={selectedDoc} />
            ) : (
              <div style={{ color: '#666', textAlign: 'center', paddingTop: '40px' }}>
                Select a document or ask a question to get started
              </div>
            )}
            {lastResponse && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: '#1a1a3e',
                borderRadius: '6px',
                border: '1px solid #0f3460',
              }}>
                <div style={{ fontSize: '14px', lineHeight: 1.6 }}>{lastResponse.answer}</div>
                {lastResponse.citations.length > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#8888bb' }}>
                    <strong>Citations:</strong>
                    {lastResponse.citations.map((c, i) => (
                      <div key={i} style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #533483' }}>
                        {c.documentTitle} (chunk {c.chunkIndex}): {c.excerpt.substring(0, 100)}...
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <QuestionPanel onAsk={handleAskQuestion} />
        </div>
      </div>

      <StatusBar status={appStatus} />
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/components/DocumentDetail.tsx`
```
import { useEffect, useState } from 'react';
import { Document, Chunk } from '../../shared/types';

interface Props {
  document: Document;
}

export function DocumentDetail({ document }: Props) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [showChunks, setShowChunks] = useState(false);

  useEffect(() => {
    window.knowledgeBase.indexing.chunks(document.id).then(setChunks);
  }, [document.id]);

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
        {document.title}
      </h2>
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
        <div>Filename: {document.filename}</div>
        <div>Imported: {new Date(document.importedAt).toLocaleString()}</div>
        <div>Size: {(document.size / 1024).toFixed(1)} KB</div>
        <div>Status: {document.status}</div>
        {document.chunks !== undefined && <div>Chunks: {document.chunks}</div>}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setShowChunks(!showChunks)}
          style={{
            padding: '6px 12px',
            background: '#0f3460',
            color: '#e0e0e0',
            border: '1px solid #1a1a4e',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {showChunks ? 'Hide' : 'Show'} Chunks ({chunks.length})
        </button>
        {document.status !== 'indexed' && (
          <button
            onClick={() => window.knowledgeBase.indexing.start(document.id)}
            style={{
              padding: '6px 12px',
              background: '#533483',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Index Document
          </button>
        )}
      </div>

      {showChunks && (
        <div>
          {chunks.map(chunk => (
            <div
              key={chunk.id}
              style={{
                padding: '10px',
                marginBottom: '8px',
                background: '#1a1a3e',
                borderRadius: '4px',
                borderLeft: '3px solid #533483',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                Chunk {chunk.index} ({chunk.metadata.charCount} chars)
              </div>
              {chunk.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/components/DocumentList.tsx`
```
import { Document } from '../../shared/types';

interface Props {
  documents: Document[];
  onSelect: (doc: Document) => void;
  selectedId: string | null;
}

export function DocumentList({ documents, onSelect, selectedId }: Props) {
  if (documents.length === 0) {
    return (
      <div style={{ padding: '20px 16px', color: '#666', fontSize: '13px', textAlign: 'center' }}>
        No documents imported yet.
        <br />
        <span style={{ fontSize: '11px', color: '#555' }}>
          Import documents to get started.
        </span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {documents.map(doc => (
        <div
          key={doc.id}
          onClick={() => onSelect(doc)}
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            borderBottom: '1px solid #0f3460',
            background: selectedId === doc.id ? '#0f3460' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{doc.title}</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            {doc.status === 'indexed' ? '✓ ' : ''}
            {(doc.size / 1024).toFixed(1)} KB
          </div>
        </div>
      ))}
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/components/ImportPanel.tsx`
```

interface Props {
  onImport: (file: File) => void;
}

export function ImportPanel({ onImport }: Props) {
  return (
    <div style={{
      padding: '20px',
      background: '#16213e',
      borderRadius: '6px',
      border: '1px dashed #0f3460',
      textAlign: 'center',
      color: '#888',
    }}>
      <div style={{ fontSize: '14px', marginBottom: '8px' }}>Import Documents</div>
      <div style={{ fontSize: '12px' }}>
        Use the import button or drag files here.
        <br />
        Supported: .txt, .md files
      </div>
      <input
        type="file"
        accept=".txt,.md"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
        }}
        style={{ marginTop: '10px' }}
      />
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/components/QuestionPanel.tsx`
```
import { useState } from 'react';

interface Props {
  onAsk: (question: string) => void;
}

export function QuestionPanel({ onAsk }: Props) {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    onAsk(question.trim());
    setQuestion('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        padding: '12px 20px',
        borderTop: '1px solid #0f3460',
        background: '#16213e',
      }}
    >
      <input
        type="text"
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask a question about your documents..."
        style={{
          flex: 1,
          padding: '10px 14px',
          background: '#1a1a2e',
          color: '#e0e0e0',
          border: '1px solid #0f3460',
          borderRadius: '6px',
          fontSize: '14px',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        style={{
          marginLeft: '10px',
          padding: '10px 20px',
          background: '#533483',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        Ask
      </button>
    </form>
  );
}

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/components/StatusBar.tsx`
```
import { AppStatus } from '../../shared/types';

interface Props {
  status: AppStatus;
}

export function StatusBar({ status }: Props) {
  const statusColor = {
    idle: '#888',
    indexing: '#f0ad4e',
    ready: '#5cb85c',
    error: '#d9534f',
  }[status.indexStatus] ?? '#888';

  return (
    <div style={{
      padding: '4px 20px',
      background: '#0f1729',
      borderTop: '1px solid #0f3460',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      fontSize: '11px',
      color: '#888',
    }}>
      <span>
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: statusColor,
          marginRight: '6px',
        }} />
        Index: {status.indexStatus}
      </span>
      <span>Documents: {status.documentsLoaded}</span>
      {status.lastActivity && (
        <span>Last activity: {new Date(status.lastActivity).toLocaleTimeString()}</span>
      )}
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/main.tsx`
```
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);

```

### Core Architecture Module: `projects/project-01/solution/src/renderer/types.d.ts`
```
/// <reference types="react" />
/// <reference types="react-dom" />

declare global {
  interface Window {
    knowledgeBase: {
      documents: {
        list: () => Promise<import('../shared/types').Document[]>;
        import: (filePath: string) => Promise<import('../shared/types').Document>;
        get: (id: string) => Promise<import('../shared/types').Document | null>;
        delete: (id: string) => Promise<boolean>;
      };
      indexing: {
        start: (documentId?: string) => Promise<import('../shared/types').AppStatus>;
        status: () => Promise<import('../shared/types').AppStatus>;
        chunks: (documentId: string) => Promise<import('../shared/types').Chunk[]>;
      };
      qa: {
        ask: (question: string) => Promise<import('../shared/types').QAResponse>;
        history: () => Promise<import('../shared/types').QAHistory[]>;
      };
    };
  }
}

export {};

```

### Core Architecture Module: `projects/project-01/starter/src/renderer/App.tsx`
```
import React, { useState, useCallback } from 'react';
import { DocumentList } from './components/DocumentList';
import { QuestionPanel } from './components/QuestionPanel';
import { DocumentDetail } from './components/DocumentDetail';
import { StatusBar } from './components/StatusBar';
import { Document, AppStatus, QAResponse } from '../../shared/types';

declare global {
  interface Window {
    knowledgeBase: {
      documents: {
        list: () => Promise<Document[]>;
        import: (filePath: string) => Promise<Document>;
        get: (id: string) => Promise<Document | null>;
        delete: (id: string) => Promise<boolean>;
      };
      indexing: {
        start: (documentId?: string) => Promise<{ status: string }>;
        status: () => Promise<AppStatus>;
        chunks: (documentId: string) => Promise<Array<{ id: string; content: string; index: number }>>;
      };
      qa: {
        ask: (question: string) => Promise<QAResponse>;
        history: () => Promise<Array<{ question: string; response: QAResponse }>>;
      };
    };
  }
}

export function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>({
    documentsLoaded: 0,
    indexStatus: 'idle',
    lastActivity: '',
  });
  const [lastResponse, setLastResponse] = useState<QAResponse | null>(null);

  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await window.knowledgeBase.documents.list();
      setDocuments(docs);
      const status = await window.knowledgeBase.indexing.status();
      setAppStatus(status);
    } catch (err) {
      console.error('Failed to refresh documents:', err);
    }
  }, []);

  const handleImport = useCallback(async () => {
    // In a real app this would open a file dialog.
    // For the course, we'll trigger import via the dev console or init script.
    console.log('Import triggered - use window.knowledgeBase.documents.import(filePath)');
  }, []);

  const handleSelectDocument = useCallback((doc: Document) => {
    setSelectedDoc(doc);
  }, []);

  const handleAskQuestion = useCallback(async (question: string) => {
    try {
      const response = await window.knowledgeBase.qa.ask(question);
      setLastResponse(response);
    } catch (err) {
      console.error('Q&A failed:', err);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{
        padding: '12px 20px',
        background: '#16213e',
        borderBottom: '1px solid #0f3460',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Knowledge Base</h1>
        <button
          onClick={refreshDocuments}
          style={{
            padding: '6px 14px',
            background: '#0f3460',
            color: '#e0e0e0',
            border: '1px solid #1a1a4e',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Refresh
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel: Document list */}
        <div style={{
          width: '280px',
          borderRight: '1px solid #0f3460',
          display: 'flex',
          flexDirection: 'column',
          background: '#16213e',
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid #0f3460',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#a0a0c0' }}>
              Documents ({documents.length})
            </span>
            <button
              onClick={handleImport}
              style={{
                padding: '4px 10px',
                background: '#533483',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              + Import
            </button>
          </div>
          <DocumentList
            documents={documents}
            onSelect={handleSelectDocument}
            selectedId={selectedDoc?.id ?? null}
          />
        </div>

        {/* Right panel: Document detail + Q&A */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {selectedDoc ? (
              <DocumentDetail document={selectedDoc} />
            ) : (
              <div style={{ color: '#666', textAlign: 'center', paddingTop: '40px' }}>
                Select a document or ask a question to get started
              </div>
            )}
            {lastResponse && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: '#1a1a3e',
                borderRadius: '6px',
                border: '1px solid #0f3460',
              }}>
                <div style={{ fontSize: '14px', lineHeight: 1.6 }}>{lastResponse.answer}</div>
                {lastResponse.citations.length > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#8888bb' }}>
                    <strong>Citations:</strong>
                    {lastResponse.citations.map((c, i) => (
                      <div key={i} style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #533483' }}>
                        {c.documentTitle} (chunk {c.chunkIndex}): {c.excerpt.substring(0, 100)}...
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <QuestionPanel onAsk={handleAskQuestion} />
        </div>
      </div>

      <StatusBar status={appStatus} />
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/starter/src/renderer/components/DocumentDetail.tsx`
```
import React, { useEffect, useState } from 'react';
import { Document, Chunk } from '../../../shared/types';

interface Props {
  document: Document;
}

export function DocumentDetail({ document }: Props) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [showChunks, setShowChunks] = useState(false);

  useEffect(() => {
    window.knowledgeBase.indexing.chunks(document.id).then(setChunks);
  }, [document.id]);

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
        {document.title}
      </h2>
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
        <div>Filename: {document.filename}</div>
        <div>Imported: {new Date(document.importedAt).toLocaleString()}</div>
        <div>Size: {(document.size / 1024).toFixed(1)} KB</div>
        <div>Status: {document.status}</div>
        {document.chunks !== undefined && <div>Chunks: {document.chunks}</div>}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setShowChunks(!showChunks)}
          style={{
            padding: '6px 12px',
            background: '#0f3460',
            color: '#e0e0e0',
            border: '1px solid #1a1a4e',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {showChunks ? 'Hide' : 'Show'} Chunks ({chunks.length})
        </button>
        {document.status !== 'indexed' && (
          <button
            onClick={() => window.knowledgeBase.indexing.start(document.id)}
            style={{
              padding: '6px 12px',
              background: '#533483',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Index Document
          </button>
        )}
      </div>

      {showChunks && (
        <div>
          {chunks.map(chunk => (
            <div
              key={chunk.id}
              style={{
                padding: '10px',
                marginBottom: '8px',
                background: '#1a1a3e',
                borderRadius: '4px',
                borderLeft: '3px solid #533483',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                Chunk {chunk.index} ({chunk.metadata.charCount} chars)
              </div>
              {chunk.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/starter/src/renderer/components/DocumentList.tsx`
```
import React from 'react';
import { Document } from '../../../shared/types';

interface Props {
  documents: Document[];
  onSelect: (doc: Document) => void;
  selectedId: string | null;
}

export function DocumentList({ documents, onSelect, selectedId }: Props) {
  if (documents.length === 0) {
    return (
      <div style={{ padding: '20px 16px', color: '#666', fontSize: '13px', textAlign: 'center' }}>
        No documents imported yet.
        <br />
        <span style={{ fontSize: '11px', color: '#555' }}>
          Import documents to get started.
        </span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {documents.map(doc => (
        <div
          key={doc.id}
          onClick={() => onSelect(doc)}
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            borderBottom: '1px solid #0f3460',
            background: selectedId === doc.id ? '#0f3460' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{doc.title}</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            {doc.status === 'indexed' ? '✓ ' : ''}
            {(doc.size / 1024).toFixed(1)} KB
          </div>
        </div>
      ))}
    </div>
  );
}

```

### Core Architecture Module: `projects/project-01/starter/src/renderer/components/ImportPanel.tsx`
```
import React from 'react';

interface Props {
  onImport: (filePath: string) => void;
}

export function ImportPanel({ onImport }: Props) {
  return (
    <div style={{
      padding: '20px',
      background: '#16213e',
      borderRadius: '6px',
      border: '1px dashed #0f3460',
      textAlign: 'center',
      color: '#888',
    }}>
      <div style={{ fontSize: '14px', marginBottom: '8px' }}>Import Documents</div>
      <div style={{ fontSize: '12px' }}>
        Use the import button or drag files here.
        <br />
        Supported: .txt, .md files
      </div>
      <input
        type="file"
        accept=".txt,.md"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onImport(file.path);
        }}
        style={{ marginTop: '10px' }}
      />
    </div>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #83** (2026-10-01): **design: replace abstract learning maps with readable course outlines**
  *Symptoms*: The learning map shows abstract workflow labels and opaque lecture/project codes, so readers cannot tell what the course teaches. Replace it with a readable course outline across all 15 README editions.  Each of the eight groups now lists its actual lecture topics and the corresponding hands-on project. Use larger text, clear lecture/project labels and a two-column editorial layout. Preserve the approved palette, light/dark themes and Arabic reading order. README prose and the other illustrations remain unchanged.  The renderer now uses course-map data with references to the actual lecture and project sources; CJK font subsets include the additional text.  Validation: checked all 14 lectures and 8 projects for every language, rendered 30 SVGs plus 15 PNGs, reviewed Chinese/English/German/Arabic layouts, checked glyph coverage and layout bounds, verified SVG references, and passed `git diff --check`. 

- **Issue #82** (2026-10-01): **design: localize README illustrations across all languages**
  *Symptoms*: Translated READMEs currently show English text inside their illustrations. Give all 14 non-English editions their own diagrams and localized wordmark tagline, so the artwork matches the selected README language.  - Translate all four diagrams, including headings, steps, captions and footer labels, while keeping project and file names intact. - Preserve the approved typography, terracotta palette, spacing and light/dark variants. Wrap longer translations and mirror the Arabic flow for right-to-left reading. - Update only image paths in translated READMEs; preserve all prose, tables, links and text diagrams. English artwork remains unchanged. - Include translation data, a reproducible renderer and font licenses. Outlined, reusable glyphs keep SVGs independent of installed fonts.  Validation: rendered and reviewed translated artwork; checked glyph coverage, layout bounds, SVG references and all README image paths; verified every translated README differs only in image URLs; `git diff --check` passed. 

- **Issue #81** (2026-10-01): **design: refresh README visuals across all 15 languages**
  *Symptoms*: The course READMEs relied on long ASCII diagrams for the harness workflow and learning path. Refresh all 15 language editions with the same editorial wordmark and four spacious visual companions: the harness pattern, five subsystems, learning path, and agent session lifecycle.  Use the existing terracotta palette, light/dark image variants, and a compact wordmark for narrow screens. Share the approved English diagram assets across languages, while preserving each edition’s original prose, tables, links, and code. Keep the original text diagrams in expandable sections with localized labels. Correct the Portuguese edition’s relative language-badge links.  Validation: removing only the new wrappers recovers the original README content exactly in all 14 translated editions and the English edition. All nine text/code diagrams per translated edition are retained. Checked relative asset paths, SVG/PNG exports, and GitHub desktop/narrow-screen rendering; ran `git diff --check`, `npm run anchors:check`, and `npm run docs:build`. 

- **Issue #80** (2026-09-30): **docs: 用真实量化案例替换第 3–5 讲的无出处数字**
  *Symptoms*: 第 3–5 讲原有匿名案例含有无法追溯的比例。本 PR 替换这些案例，并补入国外原始文章和研究中可核对的实际结果，保留案例的量化信息。  - 第 3 讲：OpenAI 报告五个月约 1,500 个 PR、平均每名工程师每天 3.5 个 PR；明确这些属于整套工程流程，不能单独归因于文档。 - 第 4 讲：Lulla 等人的配对研究使用 gpt-5.2-codex、10 个仓库和 124 个 PR 派生任务；中位耗时 98.57→70.34 秒（降低 28.64%），输出 token 中位数 2,925→2,440（降低 16.58%）。明确这是效率研究，并非文件拆分实验，也未全面评估功能正确性。同时保留 OpenAI 的文件拆分实践和 ETH Zurich 的研究边界。 - 第 5 讲：保留 Anthropic 跨会话交接机制，并加入 LangChain 在固定 GPT-5.2-Codex、89 个任务的 Terminal Bench 2.0 上 52.8%→66.5% 的实际结果（提高 13.7 个百分点）。明确这是多项 harness 调整的总体收益，不能只归因于进度文件。 - 同步 15 种语言，数字段落附原始链接，延伸阅读和资源索引补充研究，更新锚点映射。配套代码继续作为教学模拟。  验证：45 个案例的结果数字与出处检查、15 个资源索引检查、git diff --check、npm run anchors:check、npm run docs:build（33.32 秒完成）。  关联 #73；本次覆盖第 3–5 讲，其他讲义仍需单独核查，因此暂不关闭 Issue。本 PR 在已合入的 #75 基础上，将第 3–5 讲的教学示例进一步替换为有原始出处的真实量化案例。 

- **Issue #79** (2026-09-30): **Fix file path in execution comment**
  *Symptoms*: Small fix to the execution path in the command

- **Issue #78** (2026-09-30): **fix(audit-harness): close two false-PASS checks in Subsystem 1**
  *Symptoms*: ## What  Two checks in `tools/audit-harness.sh` (Subsystem 1: Instructions) report **PASS** on repos that do not meet them.  1. **`Entry file is 50–200 lines [L04]`** only tests the upper bound (`-le 200`), so a 3-line `AGENTS.md` passes. This PR enforces the lower bound as well and rewrites the fix hint so it covers both "too long" and "too short". 2. **`State files are enumerated (PROGRESS.md, feature_list)`** goes through `contains_pattern`, which uses `grep -i`, with the bare words `PROGRESS|DECISIONS`. Any sentence containing "progress" therefore passes, e.g. "This is a work in progress.", even when no state file is named. The pattern now matches the file names: `PROGRESS.md`, `DECISIONS.md`, `docs/decisions`, `feature_list`.  ## How I found it  I ran the audit on a real repo whose `CLAUDE.md` never mentions `PROGRESS.md`. Check 2 still passed, because the file contains the token `hop_progress_only`.  ## Verification  I built four minimal fixture repos, each with a single `AGENTS.md`:  | fixture | check | before | after | |---|---|---|---| | 3-line AGENTS.md | L04 length | PASS ❌ | WARN ✅ | | 100+ lines, mentions PROGRESS.md | L04 length | PASS | PASS | | "This is a work in progress." | state files | PASS ❌ | WARN ✅ | | "State lives in PROGRESS.md and feature_list.json." | state files | PASS | PASS |  `bash -n tools/audit-harness.sh` is clean. Both are RECOMMENDED checks, so the exit code is unaffected.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the contribution and the clear fixture-based verification! Both fixes address real false-PASS cases in the audit. I also checked the 49/50/200/201-line boundaries and the state-file matching. Merged. 

- **Issue #76** (2026-09-30): **Fix language switch losing the section anchor**
  *Symptoms*: ## Summary  Fixes a language switch sending the reader back to the top of the page when the URL has a section anchor. Section ids become the same in every locale, which is what vitepress.dev's own multilingual docs do. The ids get applied at build time, so no markdown file changes.  ## Problem  Open a lecture in any locale, click a section in the outline, then switch language:  ``` zh-TW  .../lecture-04-why-one-giant-instruction-file-fails/#實際案例   <- reader is on 實際案例        switch language via the navbar dropdown en     .../lecture-04-why-one-giant-instruction-file-fails/#實際案例   <- no such id, jumps to top ```  VitePress carries the current hash across a locale switch. `theme-default/composables/langs.js` builds every locale link as `normalizeLink(...) + hash.value`, with no condition on it. There is no built-in anchor translation.  Heading ids, though, get auto-slugged from heading text. No heading in this repo uses an explicit id, so each locale ends up with ids in its own language: `實際案例`, `実際の事例`, `praxisbeispiel`. The carried `#實際案例` has no matching element on the English page, so VitePress skips the hash-scroll path and calls `window.scrollTo(0, 0)`.  The convention this repo was missing is the one VitePress's own docs use. On `vitepress.dev/zh/guide/markdown` the heading is `<h2 id="header-anchors">标题锚点</h2>`. The id is the English slug and the text is translated. Switching that page's language on `#header-anchors` lands on the right section.  ## Approach  Keep headin
  **Post-Mortem & Fix Analysis**:
  > Thank you for the detailed investigation, implementation, and extensive validation! The canonical-anchor approach is a useful improvement to multilingual navigation. Before merging, I regenerated the map against #74 and added validation of actual localized heading counts, so adding or removing a translated heading cannot silently leave a stale map. The regression check and the full documentation build passed. Merged. 

- **Issue #75** (2026-09-30): **docs: add sources or mark illustrative for Real-World examples (#73)**
  *Symptoms*: ## Summary  Addresses #73. For each "Real-World Example"-style section in lectures 03–05 (English and Chinese), I searched for a verifiable source behind the concrete numbers and found none. Rather than fabricate links, I renamed the sections to **Illustrative Example** and added a one-line disclaimer stating that the scenario is a teaching illustration, not a published case study.  ## Changes by file  ### English (`docs/en/lectures/`)  - **`lecture-03-why-the-repository-must-become-the-system-of-record/index.md`**   - Heading `## A Real Transformation Story` → `## Illustrative Example`   - Added disclaimer: "This example is a teaching illustration, not a published case study — the numbers are illustrative rather than measured from a real project." - **`lecture-04-why-one-giant-instruction-file-fails/index.md`**   - Heading `## Real-World Example` → `## Illustrative Example`   - Added the same disclaimer. - **`lecture-05-why-long-running-tasks-lose-continuity/index.md`**   - Heading `## Real-World Example` → `## Illustrative Example`   - Added the same disclaimer.  ### Chinese (`docs/zh/lectures/`)  - **`lecture-03-why-the-repository-must-become-the-system-of-record/index.md`**   - Heading `## 一个真实的改造故事` → `## 示意性示例`   - Added disclaimer: "本示例为教学示意，并非已发表的真实案例——文中数字仅为让概念更具体，并非来自真实项目的实测数据。" - **`lecture-04-why-one-giant-instruction-file-fails/index.md`**   - Heading `## 实际案例` → `## 示意性示例`   - Added the same Chinese disclaimer. - **`lecture-05-why-long-running-tasks-lose-continu

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

### Incident Patch 1: `5316c90a` (2026-09-30)
**Commit Message**: Fix language switch losing the section anchor (#76)

* docs: add Hindi and Urdu translations for skills/README.md

* fix: add missing harness-designs nav item for Spanish locale

The harness-designs section was missing from the Spanish navigation
menu even though all content is translated and available. Added the
harnessDesign label to the Spanish locale configuration.

* Fix zh-TW translation residue in lecture 04

- Remove duplicated sentence in contradiction section
- Fix simplified Chinese residue (明确/记住/稀释/编寫/参考)
- Fix punctuation and Mainland lexicon (要麼->要嘛)

* Unify 專題文件 to 主題文件 in zh-TW lecture 04

* Fix Simplified residue in zh-TW harness-designs

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* Refactor zh-TW harness-designs prose: remove em-dashes, trim padding verbs

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* Attribute VILA Lab versioned claims in claude-code harness design

Qualify five-layer compaction and seven permission modes as v2.1.88 findings, flag current permission mode names, split references by authority.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* Give headings locale-invariant anchor ids

Switching language on an anchored URL dropped the re

**File**: `.github/workflows/deploy-pages.yml` (modified, +3/-0)
```diff
@@ -38,6 +38,9 @@ jobs:
       - name: Install dependencies
         run: npm ci
 
+      - name: Check heading anchor map
+        run: npm run anchors:check
+
       - name: Build with VitePress
         run: npm run docs:build
 
```

**File**: `docs/.vitepress/anchor-map.json` (added, +2765/-0)
```diff
@@ -0,0 +1,2765 @@
+{
+  "harness-designs/claude-code/index.md": {
+    "ids": [
+      "breaking-down-claude-code-s-harness-design",
+      "in-one-sentence",
+      "instruction-subsystem-a-layered-memory-system",
+      "context-subsystem-a-five-layer-compaction-pipeline",
+      "tool-subsystem-four-extension-mechanisms",
+      "feedback-and-verification-deterministic-constraints-human-agent-division-of-labor",
+      "observability-and-session-persistence",
+      "mapping-to-the-course-framework",
+      "designs-worth-adopting",
+      "references",
+      "official-anthropic-documentation",
+      "independent-community-research"
+    ],
+    "locales": {
+      "ar": 10,
+      "de": 10,
+      "en": 12,
+      "es": 10,
+      "fr": 10,
+      "ja": 10,
+      "ko": 10,
+      "pt-BR": 10,
+      "ru": 10,
+      "tr": 10,
+      "uk": 10,
+      "uz": 10,
+      "vi": 10,
+      "zh": 10,
+      "zh-TW": 12
+    }
+  },
+  "harness-designs/codex/index.md": {
+    "ids": [
+      "breaking-down-codex-s-harness-design",
+      "in-one-sentence",
+      "instruction-subsystem-agents-md-is-a-directory-page-not-an-encyclopedia",
+      "context-subsystem-write-select-compress-isolate",
+      "tools-and-boundaries-worktree-isolation-subagents",
+      "feedback-subsystem-put-verification-commands-in-the-specification",
+      "mapping-to-the-course-framework",
+      "designs-worth-adopting",
+      "references-original-sources-source-code"
+    ],
+    "locales": {
+      "ar": 9,
+      "de": 9,
+      "en": 9,
+      "es": 9,
+      "fr": 9,
+      "ja": 9,
+      "ko": 9,
+      "pt-BR": 9,
+      "ru": 9,
+      "tr": 9,
+      "uk": 9,
+      "uz": 9,
+      "vi": 9,
+      "zh": 14,
+      "zh-TW": 9
+    }
+  },
+  "harness-designs/deepseek/index.md": {
+    "ids": [
+      "breaking-down-deepseek-harness-s-design",
+      "in-one-sentence",
+      "architectural-core-1-capability-seam",
+      "architectural-core-2-event-pipeline",
+      "architectural-core-3-session-event-log-and-model-visible-means-logged",
+      "mapping-to-the-course-framework",
+      "designs-worth-adopting",
+      "references-original-sources-source-code"
+    ],
+    "locales": {
+      "ar": 8,
+      "de": 8,
+      "en": 8,
+      "es": 8,
+      "fr": 8,
+      "ja": 8,
+      "ko": 8,
+      "pt-BR": 8,
+      "ru": 8,
+      "tr": 8,
+      "uk": 8,
+      "uz": 8,
+      "vi": 8,
+      "zh": 8,
+      "zh-TW": 8
+    }
+  },
+  "harness-designs/index.md": {
+    "ids": [
+      "frontier-harness-design-breakdowns",
+      "why-these-breakdowns-matter",
+      "articles",
+      "how-to-read-this-section"
+    ],
+    "locales": {
+      "ar": 4,
+      "de": 4,
+      "en": 4,
+      "es": 4,
+      "fr": 4,
+      "ja": 4,
+      "ko": 4,
+      "pt-BR": 4,
+      "ru": 4,
+      "tr": 4,
+      "uk": 4,
+      "uz": 4,
+      "vi": 4,
+      "zh": 4,
+      "zh-TW": 4
+    }
+  },
+  "harness-designs/pi/index.md": {
+    "ids": [
+      "breaking-down-pi-s-harness-design",
+      "in-one-sentence",
+      "core-loop",
+      "instruction-subsystem-agents-md-and-system-md",
+      "state-and-context-where-pi-is-most-granular",
+      "tool-subsystem-skills-and-extensions",
+      "feedback-and-verification-making-learning-part-of-the-harness",
+      "mapping-to-the-course-framework",
+      "designs-worth-adopting",
+      "references-original-sources-source-code"
+    ],
+    "locales": {
+      "ar": 10,
+      "de": 10,
+      "en": 10,
+      "es": 10,
+      "fr": 10,
+      "ja": 10,
+      "ko": 10,
+      "pt-BR": 10,
+      "ru": 10,
+      "tr": 10,
+      "uk": 10,
+      "uz": 10,
+      "vi": 10,
+      "zh": 10,
+      "zh-TW": 10
+    }
+  },
+  "index.md": {
+    "ids": [
+      "welcome-to-learn-harness-engineering",
+      "get-started",
+      "the-core-mechanism-of-a-harness",
+      "what-you-will-learn",
+      "next-steps"
+    ],
+    "locales": {
+      "ar": 5,
+      "de": 5,
+      "en": 5,
+      "es": 5,
+      "fr": 5,
+      "ja": 5,
+      "ko": 5,
+      "pt-BR": 5,
+      "ru": 5,
+      "tr": 5,
+      "uk": 5,
+      "uz": 5,
+      "vi": 5,
+      "zh": 5,
+      "zh-TW": 5
+    }
+  },
+  "lectures/lecture-01-why-capable-agents-still-fail/code/failure-signals-checklist.md": {
+    "ids": [
+      "failure-signals-checklist"
+    ],
+    "locales": {
+      "ar": 1,
+      "de": 1,
+      "en": 1,
+      "es": 1,
+      "fr": 1,
+      "ja": 1,
+      "ko": 1,
+      "pt-BR": 1,
+      "ru": 1,
+      "tr": 1,
+      "uk": 1,
+      "uz": 1,
+      "vi": 1,
+      "zh": 1,
+      "zh-TW": 1
+    }
+  },
+  "lectures/lecture-01-why-capable-agents-still-fail/code/index.md": {
+    "ids": [
+      "code-for-lecture-01"
+    ],
+    "locales": {
+      "ar": 1,
+      "de": 1,
+      "en": 1,
+      "es": 1,
+      "fr": 1,
+      "ja": 1,
+      "ko": 1,
+      "pt-BR": 1,
+      "ru": 1,
+      "tr": 1,
+      "uk": 1,
+      "uz": 1,
+      "vi": 1,
+      "zh": 1,
+ 
```

**File**: `docs/.vitepress/config.mts` (modified, +24/-0)
```diff
@@ -1,6 +1,8 @@
 /// <reference types="node" />
 import { defineConfig } from "vitepress";
 import { withMermaid } from "vitepress-plugin-mermaid";
+import anchorMap from "./anchor-map.json";
+import { defaultSlugify } from "../../scripts/anchor-map-utils.ts";
 
 const docsBase = "/learn-harness-engineering/";
 const brandLogo = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23D95C41" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12.1" y1="11.9" x2="18.9" y2="8.2" /><line x1="12.1" y1="12.1" x2="20.3" y2="12.9" /><line x1="12.2" y1="12.4" x2="16.6" y2="19.1" /><line x1="11.8" y1="12.4" x2="7.3" y2="19.2" /><line x1="11.9" y1="12.1" x2="3.7" y2="13.3" /><line x1="11.8" y1="11.7" x2="7.8" y2="4.4" /></svg>';
@@ -900,6 +902,28 @@ export default withMermaid(
       socialLinks
     },
     markdown: {
+      anchor: {
+        // Heading ids are auto-slugged from heading text, so each locale would
+        // otherwise get ids in its own language. The language switcher carries
+        // the URL hash across locales, so a shared "#實際案例" link dead-ends
+        // after switching to English. Apply the English ids everywhere, keeping
+        // heading text translated: the same convention vitepress.dev uses.
+        //
+        // Only applied where the locale's heading count matches English; a page
+        // whose structure has drifted keeps its localized ids rather than
+        // getting ids that point at the wrong section.
+        slugifyWithState(source: string, state: any) {
+          const [locale, ...rest] = String(state.env.relativePath ?? '').split('/')
+          const page = (anchorMap as Record<string, { ids: string[]; locales: Record<string, number> }>)[
+            rest.join('/')
+          ]
+          if (page && page.locales[locale] === page.ids.length) {
+            const index = (state.env.__anchorIndex = (state.env.__anchorIndex ?? -1) + 1)
+            if (page.ids[index]) return page.ids[index]
+          }
+          return defaultSlugify(source)
+        },
+      },
       theme: {
         light: 'github-light',
         dark: 'github-dark'
```

**File**: `docs/en/harness-designs/claude-code/index.md` (modified, +2/-2)
```diff
@@ -47,7 +47,7 @@ The key design is **separation of responsibilities**: CLAUDE.md manages "what,"
 
 Lecture 10 explains that "verification only counts when the complete flow works." Claude Code implements this through two tracks:
 
-**1. Permission system (deterministic constraints).** Claude Code's permissions do not simply "ask about everything." According to VILA Lab's analysis of v2.1.88, the system combined seven modes with an ML-based classifier at that time: low-risk operations are allowed, while high-risk operations are either confirmed or denied according to policy (for architectural details, see the [VILA Lab analysis](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf)). Note that permission-mode naming has changed since v2.1.88: current Anthropic docs ([permission modes](https://code.claude.com/docs/en/permission-modes)) list Manual (formerly "default", relabeled in v2.1.200+), Plan, acceptEdits, Auto, and bypassPermissions. This turns "setting clear task boundaries for the agent" (Lecture 7) into runtime enforcement instead of a plea in a prompt.
+**1. Permission system (deterministic constraints).** Claude Code's permissions do not simply "ask about everything." According to VILA Lab's analysis of v2.1.88, the system combined seven modes with an ML-based classifier at that time: low-risk operations are allowed, while high-risk operations are either confirmed or denied according to policy (for architectural details, see the [VILA Lab analysis](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf)). Note that permission-mode naming has changed since v2.1.88: current Anthropic docs ([permission modes](https://code.claude.com/docs/en/permission-modes)) list Manual (formerly "default", relabeled in v2.1.200+), Plan, acceptEdits, Auto, dontAsk, and bypassPermissions. This turns "setting clear task boundaries for the agent" (Lecture 7) into runtime enforcement instead of a plea in a prompt.
 
 **2. Hooks (preventing premature declarations of completion).** `PostToolUse` hooks can force checks to run after tool execution and write the results back into the context; `Stop` hooks intervene when the agent declares completion. This separates "the one doing the work" from "the one checking the work." [Anthropic explicitly observed in its harness article](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) that agents "confidently praised their work," so hooks inject **deterministic** checks instead of trusting the model's self-evaluation.
 
@@ -83,7 +83,7 @@ Every claim can be traced back to the sources below, avoiding secondhand recolle
 
 - **Claude Code · Memory**: A fresh context for every session, the four CLAUDE.md scopes, on-demand loading by subdirectory, auto memory (200 lines / 25KB), and `/init` generation of CLAUDE.md.<br/>https://code.claude.com/docs/en/memory
 - **Claude Code · Skills / MCP / Hooks / Sub-agents**: Definitions of the four extension mechanisms and their events (PreToolUse / PostToolUse / Stop).<br/>https://code.claude.com/docs/en/skills | https://code.claude.com/docs/en/mcp | https://code.claude.com/docs/en/hooks | https://code.claude.com/docs/en/sub-agents
-- **Claude Code · Permission modes**: Current mode names Manual (formerly "default", relabeled in v2.1.200+), Plan, acceptEdits, Auto, and bypassPermissions.<br/>https://code.claude.com/docs/en/permission-modes
+- **Claude Code · Permission modes**: Current mode names Manual (formerly "default", relabeled in v2.1.200+), Plan, acceptEdits, Auto, dontAsk, and bypassPermissions.<br/>https://code.claude.com/docs/en/permission-modes
 - **Anthropic, Effective harnesses for long-running agents**: The source for the claims that "reliability comes from the harness rather than the model," that agents "confidently praised their work," and that hooks should be used for verification.<br/>https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
 
 ### Independent/community research
```

**File**: `docs/zh-TW/harness-designs/claude-code/index.md` (modified, +2/-2)
```diff
@@ -47,7 +47,7 @@ Claude Code 把擴充介面分成四類，每一類解決一種問題，這是
 
 課程第十講談「跑通完整流程才算真正驗證」，Claude Code 對應的機制是雙軌制：
 
-**1. permissions 系統（確定性約束）。** Claude Code 的 permissions 不是「全部都詢問一遍」，根據 VILA Lab 對 v2.1.88 的拆解，當時的系統採用七種模式 + 一個基於 ML 的分類器：低風險操作放行，高風險操作則依原則詢問或拒絕（架構細節請參閱 [VILA Lab 拆解](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf)）。注意 v2.1.88 之後 permissions 模式命名已有變動：目前官方文件（[permission modes](https://code.claude.com/docs/en/permission-modes)）列出 Manual（原 "default"，v2.1.200+ 起改名）、Plan、acceptEdits、Auto 與 bypassPermissions。這是把「為 agent 劃清邊界」（第七講）做成執行時期的強制機制，而不是靠提示詞懇求。
+**1. permissions 系統（確定性約束）。** Claude Code 的 permissions 不是「全部都詢問一遍」，根據 VILA Lab 對 v2.1.88 的拆解，當時的系統採用七種模式 + 一個基於 ML 的分類器：低風險操作放行，高風險操作則依原則詢問或拒絕（架構細節請參閱 [VILA Lab 拆解](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf)）。注意 v2.1.88 之後 permissions 模式命名已有變動：目前官方文件（[permission modes](https://code.claude.com/docs/en/permission-modes)）列出 Manual（原 "default"，v2.1.200+ 起改名）、Plan、acceptEdits、Auto、dontAsk 與 bypassPermissions。這是把「為 agent 劃清邊界」（第七講）做成執行時期的強制機制，而不是靠提示詞懇求。
 
 **2. hooks（防止提前宣告完成）。** `PostToolUse` hooks 可以在工具執行後強制檢查、把結果寫回上下文；`Stop` hooks 則在 agent 宣告完成時介入。這就是「做事的人和檢查的人分開」，[Anthropic 在 harness 文章裡明確觀察到](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)，agent 會自信地稱讚自己的工作（"confidently praised their work"），因此用 hooks 注入**確定性**檢查，而不是信任模型的自我評估。
 
@@ -83,7 +83,7 @@ Claude Code 的日誌是完整的附加式記錄（history.jsonl），加上 `/c
 
 - **Claude Code 官方文件 · Memory**：每次 session 使用全新上下文、CLAUDE.md 四種作用範圍、子目錄隨選載入、auto memory（200 行 / 25KB）、`/init` 產生 CLAUDE.md。<br/>https://code.claude.com/docs/en/memory
 - **Claude Code 官方文件 · Skills / MCP / Hooks / Sub-agents**：四種擴充機制的定義與事件（PreToolUse / PostToolUse / Stop）。<br/>https://code.claude.com/docs/en/skills ｜ https://code.claude.com/docs/en/mcp ｜ https://code.claude.com/docs/en/hooks ｜ https://code.claude.com/docs/en/sub-agents
-- **Claude Code 官方文件 · Permission modes**：目前的模式名稱 Manual（原 "default"，v2.1.200+ 起改名）、Plan、acceptEdits、Auto 與 bypassPermissions。<br/>https://code.claude.com/docs/en/permission-modes
+- **Claude Code 官方文件 · Permission modes**：目前的模式名稱 Manual（原 "default"，v2.1.200+ 起改名）、Plan、acceptEdits、Auto、dontAsk 與 bypassPermissions。<br/>https://code.claude.com/docs/en/permission-modes
 - **Anthropic《Effective harnesses for long-running agents》**：「可靠性來自 harness 而非模型」、agent 會自信地稱讚自己的工作、用 hooks 進行驗證等觀點的出處。<br/>https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
 
 ### 獨立研究 / 社群資源
```

**File**: `package.json` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@
     "docs:build": "vitepress build docs",
     "docs:preview": "vitepress preview docs",
     "lecture:run": "tsx",
+    "anchors:build": "node --import tsx scripts/build-anchor-map.ts",
+    "anchors:check": "node --import tsx scripts/validate-anchors.ts",
     "screenshots:readme": "node --import tsx scripts/capture-readme-screenshots.ts",
     "pdf:export": "node --import tsx scripts/build-course-pdfs.ts",
     "pdf:build": "npm run docs:build && npm run pdf:export"
```

**File**: `scripts/anchor-map-utils.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+// Heading-id helpers shared by the anchor-map generator, the VitePress config,
+// and the anchor validator.
+//
+// The slugifier below is a transcription of VitePress's default
+// (node_modules/vitepress/dist/node/chunk-D3CUZ4fa.js). It is deliberately not
+// github-slugger, which is declared in package.json but unused: the two disagree
+// on underscores ("foo_bar" -> "foo-bar" vs "foo_bar") and on leading digits
+// ("1. Getting Started" -> "_1-getting-started" vs "1-getting-started").
+
+const rControl = new RegExp('[\\u0000-\\u001f]', 'g')
+const rCombining = new RegExp('[\\u0300-\\u036f]', 'g')
+const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g
+
+export function defaultSlugify(input: string): string {
+  return input
+    .normalize('NFKD')
+    .replace(rCombining, '')
+    .replace(rControl, '')
+    .replace(rSpecial, '-')
+    .replace(/-{2,}/g, '-')
+    .replace(/^-+|-+$/g, '')
+    .replace(/^(\d)/, '_$1')
+    .toLowerCase()
+}
+
+export function localeStrippedPath(relativePath: string): string {
+  return relativePath.replace(/^[^/]+\//, '')
+}
+
+// Heading levels that get anchor ids. VitePress's anchor plugin defaults to
+// level 1, and its unique-slug counter starts at the H1, so ids must be
+// collected from level 1 or every index shifts.
+export const MAX_ANCHOR_LEVEL = 3
+
+// Fence-aware: parse with the real renderer rather than matching /^##/ , which
+// counts pseudo-headings inside ```markdown blocks (lecture-04 has 9 real
+// headings and 12 by naive regex).
+export function collectHeadingIds(md: any, source: string): string[] {
+  const tokens = md.parse(source, {})
+  const ids: string[] = []
+  // markdown-it-anchor keeps a set of taken ids and suffixes collisions with a
+  // per-slug counter: "dup", "dup-1", "dup-2".
+  const taken = new Set<string>()
+
+  for (let i = 0; i < tokens.length; i++) {
+    const token = tokens[i]
+    if (token.type !== 'heading_open') continue
+
+    const level = Number(token.tag.slice(1))
+    if (level > MAX_ANCHOR_LEVEL) continue
+
+    const title = tokens[i + 1]?.content ?? ''
+    const base = defaultSlugify(title)
+
+    let candidate = base
+    let suffix = 1
+    while (taken.has(candidate)) {
+      candidate = `${base}-${suffix}`
+      suffix++
+    }
+
+    taken.add(candidate)
+    ids.push(candidate)
+  }
+
+  return ids
+}
```

**File**: `scripts/build-anchor-map.ts` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+// Generates docs/.vitepress/anchor-map.json.
+//
+// Heading ids are auto-slugged from heading text, so every locale gets ids in
+// its own language. The language switcher carries the URL hash across locales
+// (vitepress/dist/client/theme-default/composables/langs.js appends hash.value
+// unconditionally), so a shared link such as "#實際案例" dead-ends after
+// switching to English.
+//
+// This script records the English ids as canonical so the VitePress config can
+// apply them to every locale, matching how vitepress.dev itself behaves: ids are
+// locale-invariant, heading text is translated.
+//
+// Run from the repo root: node --import tsx scripts/build-anchor-map.ts
+
+import path from 'node:path'
+import { promises as fs } from 'node:fs'
+import { createMarkdownRenderer } from 'vitepress'
+import { collectHeadingIds, localeStrippedPath } from './anchor-map-utils.ts'
+import { docsRoot } from './export-site-utils.ts'
+
+const anchorMapPath = path.resolve(docsRoot, '.vitepress/anchor-map.json')
+
+export type AnchorMapEntry = {
+  // Canonical ids in document order, covering heading levels 1..3.
+  ids: string[]
+  // Heading count per locale, so the validator can tell an intentionally
+  // unanchored page (structure drift) from a regression.
+  locales: Record<string, number>
+}
+
+export type AnchorMap = Record<string, AnchorMapEntry>
+
+const SOURCE_LOCALE = 'en'
+
+async function listLocales(): Promise<string[]> {
+  const entries = await fs.readdir(docsRoot, { withFileTypes: true })
+  return entries
+    .filter((entry) => entry.isDirectory() && entry.name !== 'public' && entry.name !== '.vitepress')
+    .map((entry) => entry.name)
+    .sort()
+}
+
+async function walkMarkdown(targetDir: string): Promise<string[]> {
+  const entries = await fs.readdir(targetDir, { withFileTypes: true })
+  const nested = await Promise.all(
+    entries.map(async (entry) => {
+      const full = path.join(targetDir, entry.name)
+      if (entry.isDirectory()) return walkMarkdown(full)
+      return entry.isFile() && entry.name.endsWith('.md') ? [full] : []
+    }),
+  )
+  return nested.flat()
+}
+
+async function main() {
+  const md = await createMarkdownRenderer(docsRoot, {}, '/')
+  const locales = await listLocales()
+
+  if (!locales.includes(SOURCE_LOCALE)) {
+    throw new Error(`Source locale "${SOURCE_LOCALE}" not found under ${docsRoot}`)
+  }
+
+  const anchorMap: AnchorMap = {}
+  const sourceFiles = (await walkMarkdown(path.join(docsRoot, SOURCE_LOCALE))).sort()
+  const sourceKeys = new Set<string>()
+
+  for (const file of sourceFiles) {
+    const relativePath = path.relative(docsRoot, file).split(path.sep).join('/')
+    const key = localeStrippedPath(relativePath)
+    const ids = collectHeadingIds(md, await fs.readFile(file, 'utf8'))
+
+    if (ids.length === 0) continue
+    sourceKeys.add(key)
+    anchorMap[key] = { ids, locales: {} }
+  }
+
+  // Record how many headings each locale actually has, so the config applies the
+  // canonical ids only where the structure lines up.
+  for (const locale of locales) {
+    const files = await walkMarkdown(path.join(docsRoot, locale))
+    for (const file of files) {
+      const key = localeStrippedPath(path.relative(docsRoot, file).split(path.sep).join('/'))
+      if (!sourceKeys.has(key)) continue
+      const ids = collectHeadingIds(md, await fs.readFile(file, 'utf8'))
+      anchorMap[key].locales[locale] = ids.length
+    }
+  }
+
+  await fs.writeFile(anchorMapPath, `${JSON.stringify(anchorMap, null, 2)}\n`, 'utf8')
+
+  const pages = Object.keys(anchorMap).length
+  const aligned = Object.values(anchorMap).filter((entry) =>
+    Object.entries(entry.locales).every(([, count]) => count === entry.ids.length),
+  ).length
+
+  console.log(`Wrote ${path.relative(process.cwd(), anchorMapPath)}`)
+  console.log(`  pages: ${pages}`)
+  console.log(`  all-locales-aligned: ${aligned}`)
+  console.log(`  with drift: ${pages - aligned}`)
+}
+
+main().catch((error) => {
+  console.error(error)
+  process.exitCode = 1
+})
```

---

### Incident Patch 2: `8e9ac238` (2026-09-30)
**Commit Message**: fix: add missing harness-designs nav item for Spanish locale (#71)

The harness-designs section was missing from the Spanish navigation
menu even though all content is translated and available. Added the
harnessDesign label to the Spanish locale configuration.

**File**: `docs/.vitepress/config.mts` (modified, +1/-0)
```diff
@@ -1061,6 +1061,7 @@ export default withMermaid(
           resources: "Biblioteca",
           skills: "Skills",
           resourceLibrary: "Biblioteca de recursos",
+          harnessDesign: "Análisis de los harness más avanzados",
           tryHarness: "Try Harness ↗",
           outline: "En esta página",
           prev: "Anterior",
```

---

### Incident Patch 3: `0aa032d2` (2026-09-30)
**Commit Message**: fix: zh-TW translation residue in Lecture 04 (#72)

* Fix zh-TW translation residue in lecture 04

- Remove duplicated sentence in contradiction section
- Fix simplified Chinese residue (明确/记住/稀释/编寫/参考)
- Fix punctuation and Mainland lexicon (要麼->要嘛)

* Unify 專題文件 to 主題文件 in zh-TW lecture 04

**File**: `docs/zh-TW/lectures/lecture-04-why-one-giant-instruction-file-fails/index.md` (modified, +16/-16)
```diff
@@ -23,7 +23,7 @@
 
 **維護衰減。** 大檔案天生難維護。指令過時了沒人刪，因為刪除的後果不確定（「也許別的地方依賴這條規則？」），但加新指令是無成本的。結果檔案只增不減，信噪比持續下降。這和軟體裡的技術債務積累一模一樣。
 
-**矛盾累積。** 不同時期加的指令之間開始出現矛盾，一條說「用 TypeScript 嚴格模式」，另一條說「某些遺留檔案允許用 any」。Agent 每次隨機選一條遵循。Agent 每次碰到矛盾指令只能隨機選一條遵循。
+**矛盾累積。** 不同時期加的指令之間開始出現矛盾，一條說「用 TypeScript 嚴格模式」，另一條說「某些遺留檔案允許用 any」。Agent 每次隨機選一條遵循。
 
 ## 核心概念
 
@@ -49,17 +49,17 @@ flowchart LR
 flowchart TB
     File["600 行指令檔案"] --> Top["頂部<br/>快速開始 + 硬約束"]
     File --> Mid["中部<br/>第 300 行的安全規則"]
-    File --> Bot["底部<br/>明确的結束檢查清單"]
-    Top --> Seen["高概率被记住"]
+    File --> Bot["底部<br/>明確的結束檢查清單"]
+    Top --> Seen["高機率被記住"]
     Bot --> Seen
-    Mid --> Missed["高概率被稀释或忽略"]
+    Mid --> Missed["高機率被稀釋或忽略"]
 ```
 
 ## 拆分思路
 
 核心原則，常用資訊放手邊，偶爾用的收起來，用不上的別帶。
 
-入口檔案 `AGENTS.md` 控制在 50-200 行，只放最常用的東西，專案概覽（一兩句話說清楚這是什麼）、首次執行命令（`make setup && make test`）、全域硬約束（不超過 15 條不可違反的規則）、指向專題文件的連結（一行描述 + 適用條件）。
+入口檔案 `AGENTS.md` 控制在 50-200 行，只放最常用的東西，專案概覽（一兩句話說清楚這是什麼）、首次執行命令（`make setup && make test`）、全域硬約束（不超過 15 條不可違反的規則）、指向主題文件的連結（一行描述 + 適用條件）。
 
 ```markdown
 # AGENTS.md
@@ -77,19 +77,19 @@ Python 3.11 FastAPI 後端，PostgreSQL 15 資料庫。
 - 所有資料庫查詢必須用 SQLAlchemy 2.0 語法
 - 所有 PR 必須通過 pytest + mypy --strict + ruff check
 
-## 專題文件
+## 主題文件
 - API 設計規範 (`docs/api-patterns.md`) — 添加新端點時必讀
 - 資料庫操作約束 (`docs/database-rules.md`) — 涉及資料庫修改時必讀
-- 測試標準 (`docs/testing-standards.md`) — 编寫測試時参考
+- 測試標準 (`docs/testing-standards.md`) — 編寫測試時參考
 ```
 
-每個專題文件 50-150 行，按主題放在 `docs/` 目錄下或對應模組目錄旁。Agent 只在需要時才去讀。找東西不用翻整份文件。
+每個主題文件 50-150 行，按主題放在 `docs/` 目錄下或對應模組目錄旁。Agent 只在需要時才去讀。找東西不用翻整份文件。
 
 還有些資訊直接放在程式碼裡更合適，類型定義、介面註釋、配置檔案裡的說明。Agent 讀程式碼的時候自然能看到，不用再在指令裡重複一遍。
 
 每條指令都應該標明來源（「為什麼加這條規則？」）、適用條件（「這條規則在什麼時候需要？」）、過期條件（「什麼情況下可以刪掉這條規則？」）。定期審計，刪掉過時的、冗餘的、矛盾的條目。像管理程式碼依賴一樣管理你的指令，用不上的依賴就該刪掉，不然它們只會拖慢系統。
 
-如果某條指令必須在入口檔案裡，放頂部或底部，不要放中間。「中間迷失」效應告訴我們，LLM 對長文字中間部分的資訊利用效率顯著低於兩端。但更好的做法是把指令放到專題文件裡，讓 agent 按需加載。
+如果某條指令必須在入口檔案裡，放頂部或底部，不要放中間。「中間迷失」效應告訴我們，LLM 對長文字中間部分的資訊利用效率顯著低於兩端。但更好的做法是把指令放到主題文件裡，讓 agent 按需加載。
 
 OpenAI 和 Anthropic 都隱性支援拆分的做法。OpenAI 說入口檔案應「短小且以路由為導向」，Anthropic 說長執行 agent 的控制資訊應「簡潔且高優先級」。兩家都在說同一件事，別把什麼都塞進一個檔案裡。
 
@@ -101,17 +101,17 @@ Agent 表現開始明顯下降：簡單 bug 修復任務中 agent 花大量脈
 
 團隊執行了文件重組：
 1. `AGENTS.md` 裁剪到 80 行：只保留專案概覽、執行命令、15 條全域硬約束
-2. 建立專題文件：`docs/api-patterns.md`（120 行）、`docs/database-rules.md`（60 行）、`docs/testing-standards.md`（80 行）
-3. 路由檔案添加指向專題文件的連結
-4. 歷史筆記要麼轉成測試用例，要麼刪除
+2. 建立主題文件：`docs/api-patterns.md`（120 行）、`docs/database-rules.md`（60 行）、`docs/testing-standards.md`（80 行）
+3. 路由檔案添加指向主題文件的連結
+4. 歷史筆記要嘛轉成測試用例，要嘛刪除
 
 重構後：同一任務集的成功率從 45% 提升到 72%。安全約束遵循率從 60% 提升到 95%，因為從檔案中間移到了路由檔案頂部，不再被「中間迷失」了。
 
 ## 關鍵要點
 
-- 「加條規則」是短期的止痛藥，長期的毒藥。每次加規則前想想：這條規則放專題文件是不是更合適？，別把所有規則都堆進入口文件。
+- 「加條規則」是短期的止痛藥，長期的毒藥。每次加規則前想想：這條規則放主題文件是不是更合適。
 - 入口檔案是路由器，不是百科全書。50-200 行，只放概覽、硬約束、和連結。
-- 利用「中間迷失」效應：重要資訊放檔案頂部或底部，不重要的移到專題文件。
+- 利用「中間迷失」效應：重要資訊放檔案頂部或底部，不重要的移到主題文件。
 - 像管理技術債一樣管理指令膨脹。定期審計，每條指令要有來源、適用條件、和過期條件。
 - 拆分之後信噪比提升，agent 把更多脈絡預算花在實際任務上，而不是處理無關指令。
 
@@ -125,8 +125,8 @@ Agent 表現開始明顯下降：簡單 bug 修復任務中 agent 花大量脈
 
 ## 練習
 
-1. **信噪比審計**：拿你目前的入口指令檔案，列出所有指令條目。選 5 個不同的常見任務類型，標註每條指令是否跟該任務相關。計算每個任務類型的 SNR。那些對大多數任務都是噪聲的指令，移到專題文件裡。
+1. **信噪比審計**：拿你目前的入口指令檔案，列出所有指令條目。選 5 個不同的常見任務類型，標註每條指令是否跟該任務相關。計算每個任務類型的 SNR。那些對大多數任務都是噪聲的指令，移到主題文件裡。
 
-2. **漸進式披露重構**：如果你有一個超過 300 行的指令檔案，把它拆成：(a) 不超過 100 行的路由檔案，(b) 3-5 個專題文件。重構前後各跑同一組任務（至少 5 個），對比成功率。
+2. **漸進式披露重構**：如果你有一個超過 300 行的指令檔案，把它拆成：(a) 不超過 100 行的路由檔案，(b) 3-5 個主題文件。重構前後各跑同一組任務（至少 5 個），對比成功率。
 
 3. **中間迷失驗證**：在一個長指令檔案裡，把一條關鍵約束分別放在頂部、中間、底部各跑一組任務（每組至少 5 次），看遵循率有沒有差別。你可能會驚訝於位置效應有多大。
```

---

### Incident Patch 4: `3f85661c` (2026-09-30)
**Commit Message**: fix(audit-harness): close two false-PASS checks in Subsystem 1 (#78)

1. "Entry file is 50-200 lines [L04]" only tested the upper bound, so a
   3-line AGENTS.md passed. Enforce the lower bound too, and make the fix
   hint cover both directions.
2. "State files are enumerated" used contains_pattern (grep -i) with bare
   PROGRESS|DECISIONS, so any prose containing the word "progress" (e.g.
   "work in progress") passed without naming a state file. Match the file
   names (PROGRESS.md, DECISIONS.md, docs/decisions, feature_list).

Repro (4 fixtures): before 2/4 wrong (both bug fixtures PASS), after 4/4
(bug fixtures WARN, controls with 100+ lines / PROGRESS.md still PASS).
Found while auditing a real repo whose CLAUDE.md passed check 2 only via
the token "hop_progress_only".

Co-authored-by: OpenClaw System <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `tools/audit-harness.sh` (modified, +3/-3)
```diff
@@ -127,7 +127,7 @@ if [[ "$inst" == "pass" ]]; then
     "$(contains_pattern "$ipath" "(MUST|MUST NOT|must not|must never|constraint|forbidden|never)")" \
     "Add a Constraints section to $ipath with explicit MUST / MUST NOT rules."
   check_recommended "State files are enumerated (PROGRESS.md, feature_list)" \
-    "$(contains_pattern "$ipath" "(PROGRESS|feature_list|DECISIONS)")" \
+    "$(contains_pattern "$ipath" "(PROGRESS\.md|feature_list|DECISIONS\.md|docs/decisions)")" \
     "Reference PROGRESS.md, DECISIONS.md, and feature_list.json in $ipath so agents know where state lives."
   check_recommended "Documentation staleness rule present (update docs with code, no stale docs)" \
     "$(contains_pattern "$ipath" "(stale|staleness|same commit|doc.*update|update.*doc|outdated)")" \
@@ -139,8 +139,8 @@ if [[ "$inst" == "pass" ]]; then
   # L04: Split instructions
   _inst_lines="$(wc -l < "$REPO/$ipath" 2>/dev/null || echo 999)"
   check_recommended "Entry file is 50–200 lines (router, not encyclopedia) [L04]" \
-    "$([[ $_inst_lines -le 200 ]] && echo "pass" || echo "fail")" \
-    "$ipath is $_inst_lines lines — split detailed sections into docs/ topic files and link to them from $ipath."
+    "$([[ $_inst_lines -ge 50 && $_inst_lines -le 200 ]] && echo "pass" || echo "fail")" \
+    "$ipath is $_inst_lines lines (target 50–200) — if longer, split detailed sections into docs/ topic files and link to them; if shorter, add the missing router sections (overview, verification, constraints, state files)."
   check_recommended "Entry file links to topic documents in docs/ [L04]" \
     "$(contains_pattern "$ipath" "(docs/[a-z])")" \
     "Add links in $ipath to topic docs in docs/ (e.g. 'See [Architecture](docs/architecture.md)')."
```

---

### Incident Patch 5: `abdd8e42` (2026-09-30)
**Commit Message**: Fix file path in execution comment (#79)

**File**: `docs/en/lectures/lecture-02-what-a-harness-actually-is/code/harness-vs-no-harness.ts` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
  * a harness. The harness version adds explicit rules, verification steps,
  * and stop conditions.
  *
- * Run: npx tsx docs/lectures/lecture-02-what-a-harness-actually-is/code/harness-vs-no-harness.ts
+ * Run: npx tsx docs/en/lectures/lecture-02-what-a-harness-actually-is/code/harness-vs-no-harness.ts
  */
 
 // ---------------------------------------------------------------------------
```

---

### Incident Patch 6: `77e7a3e2` (2026-08-26)
**Commit Message**: Merge pull request #65 from alecchen/fix/lecture-03-atomicity-analogy

Fix inaccurate git analogy in Lecture 03 (Atomicity, ACID section)

**File**: `docs/en/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ project/
 
 This analogy comes from database transaction management. You might feel like this is overcomplicating things, but it actually provides a very practical framework:
 
-- **Atomicity**: Each "logical operation" (e.g., "add new endpoint and update tests") gets one git commit. If it fails midway, `git stash` to roll back. All or nothing — no "half done."
+- **Atomicity**: A "logical operation" (say, adding an endpoint and updating its tests) is committed as a whole only once it's complete and verified. A failed or abandoned attempt gets discarded, not partially merged. All or nothing.
 - **Consistency**: Define "consistent state" verification predicates — all tests pass, lint reports zero errors. The agent runs verification after each operation; inconsistent intermediate states should not be committed. After an operation, the system should be in a verifiably correct state.
 - **Isolation**: When multiple agents work concurrently, design state files to avoid race conditions. Simple approach: each agent uses its own progress file, or use git branches for isolation. Concurrent writes to the same file are a common source of trouble.
 - **Durability**: Critical project knowledge lives in git-tracked files. Temporary state can stay in session memory, but knowledge that must survive across sessions has to be written to files. What's in your head doesn't count — only what's written down counts.
```

**File**: `docs/zh-TW/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ project/
 
 這個類比來自資料庫的事務管理，你可能覺得這是在把簡單的事情搞複雜，但實際上它給了你一個非常實用的框架。
 
-- **原子性**：每次「邏輯操作」（比如「添加新端點並更新測試」）用一個 git commit 原子化。中途掛了就 `git stash` 回溯。要麼全做，要麼不做，沒有「做了一半」。
+- **原子性**：每個「邏輯操作」（例如新增端點並更新測試）要等全部改完、驗證通過，才提交成一個 commit。做到一半失敗或放棄，直接丟掉，別留半成品。要嘛做完，要嘛當作沒發生過。
 - **一致性**：定義「一致狀態」的驗證謂詞，所有測試通過、lint 無報錯。Agent 每次操作後跑驗證，不一致的中間狀態不要 commit。
 - **隔離性**：多個 agent 併發工作時，狀態檔案要避免競爭條件。簡單方案：每個 agent 用獨立的進度檔案，或者用 git 分支隔離。
 - **持久性**：關鍵的專案知識用 git 跟蹤的檔案持久化。臨時狀態可以只在工作階段的記憶體中，但跨工作階段必須的知識必須寫到檔案裡。
```

---

### Incident Patch 7: `f8680b3b` (2026-08-25)
**Commit Message**: Fix inaccurate git analogy in Lecture 03 Atomicity bullet

Reframe the Atomicity bullet (ACID section) so a commit represents completion rather than a checkpoint to roll back from, and describe discarding an abandoned attempt at the principle level instead of naming git stash (a suspend/resume operation, not a rollback). Update the zh-TW translation to match.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `docs/en/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ project/
 
 This analogy comes from database transaction management. You might feel like this is overcomplicating things, but it actually provides a very practical framework:
 
-- **Atomicity**: Each "logical operation" (e.g., "add new endpoint and update tests") gets one git commit. If it fails midway, `git stash` to roll back. All or nothing — no "half done."
+- **Atomicity**: A "logical operation" (say, adding an endpoint and updating its tests) is committed as a whole only once it's complete and verified. A failed or abandoned attempt gets discarded, not partially merged. All or nothing.
 - **Consistency**: Define "consistent state" verification predicates — all tests pass, lint reports zero errors. The agent runs verification after each operation; inconsistent intermediate states should not be committed. After an operation, the system should be in a verifiably correct state.
 - **Isolation**: When multiple agents work concurrently, design state files to avoid race conditions. Simple approach: each agent uses its own progress file, or use git branches for isolation. Concurrent writes to the same file are a common source of trouble.
 - **Durability**: Critical project knowledge lives in git-tracked files. Temporary state can stay in session memory, but knowledge that must survive across sessions has to be written to files. What's in your head doesn't count — only what's written down counts.
```

**File**: `docs/zh-TW/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ project/
 
 這個類比來自資料庫的事務管理，你可能覺得這是在把簡單的事情搞複雜，但實際上它給了你一個非常實用的框架。
 
-- **原子性**：每次「邏輯操作」（比如「添加新端點並更新測試」）用一個 git commit 原子化。中途掛了就 `git stash` 回溯。要麼全做，要麼不做，沒有「做了一半」。
+- **原子性**：每個「邏輯操作」（例如新增端點並更新測試）要等全部改完、驗證通過，才提交成一個 commit。做到一半失敗或放棄，直接丟掉，別留半成品。要嘛做完，要嘛當作沒發生過。
 - **一致性**：定義「一致狀態」的驗證謂詞，所有測試通過、lint 無報錯。Agent 每次操作後跑驗證，不一致的中間狀態不要 commit。
 - **隔離性**：多個 agent 併發工作時，狀態檔案要避免競爭條件。簡單方案：每個 agent 用獨立的進度檔案，或者用 git 分支隔離。
 - **持久性**：關鍵的專案知識用 git 跟蹤的檔案持久化。臨時狀態可以只在工作階段的記憶體中，但跨工作階段必須的知識必須寫到檔案裡。
```

---

### Incident Patch 8: `69c153bd` (2026-08-21)
**Commit Message**: Distinguish Codex product practices from new harness commits

**File**: `docs/zh/harness-designs/codex/index.md` (modified, +27/-21)
```diff
@@ -1,12 +1,14 @@
 # 拆解 Codex 的 harness 设计
 
-这篇文档要区分两层：
+> **关于"Codex 本身"与"harness 新 commit"的区分**：本文档涉及两个时间线。
+> - **Codex 产品/实践本身**（来自 2025 年起的 [Harness Engineering](https://openai.com/index/harness-engineering/) 等文章）：AGENTS.md 目录页、worktree 隔离、spawn_agent 子智能体、审批策略等——这些是 Codex **一直就有** 的 harness 哲学，不是新 commit。
+> - **2026-08-19 的 "Codex as a platform" 新 commit**：正式将整个 harness 以 Apache-2.0 开源，并新发布/新文档化 `codex exec` 非交互模式、Codex SDK、Codex app-server（JSON-RPC 2.0 协议）、"三层集成入口"架构、以及"围绕真实工作流构建软件"的平台生态主张。以下各节会明确标注。
 
-**Codex 本身**：OpenAI 的 AI 编程产品，包含 CLI、App、IDE 扩展、Codex Web。其中 IDE 扩展和 Codex Web 不开源；CLI 对应的开源仓库是 [github.com/openai/codex](https://github.com/openai/codex)（Apache-2.0），这个仓库早就存在，持续迭代，到 2026-08-20 已有 9590 个提交、579 位贡献者、999 个 release，最新版本是 `0.148.0`。
+2026 年 8 月 19 日，OpenAI 在《[Codex as a platform: build on the open agent harness](https://developers.openai.com/blog/codex-as-a-platform)》里宣布：**把驱动 Codex 的整个 harness 以 Apache-2.0 协议全面开源**。这不是又一个 CLI 工具开源——OpenAI 把自家顶级 AI 智能体的"发动机"直接交给了开发者，让你可以在自己的产品、工程工具、运营看板里嵌入完整的智能体循环，而不是把业务流程硬塞进一个通用聊天框。
 
-**2026-08-19 新开源/更新的 harness 层**：这是本次要拆解的重点。OpenAI 当天发布博客《[Codex as a platform: build on the open agent harness](https://developers.openai.com/blog/codex-as-a-platform)》，宣布把驱动所有 Codex 体验的**底层 harness 系统**以 Apache-2.0 全面开源，并正式推出三层集成入口（`codex exec` / Codex SDK / Codex app-server）。这不是产品层面的新功能发布，而是把原来藏在产品里的"执行引擎"变成了可嵌入的开源平台。
+Codex 可能是四款产品里和"harness 原教旨"绑定最深的一个。那篇定义了整个领域名字的《[Harness Engineering](https://openai.com/index/harness-engineering/)》，本身就是 OpenAI 团队用 Codex 写产品时的经验总结。如今 Codex 把 harness 从"产品里的隐藏层"变成了"开源平台"，等于把那篇文章背后的工程实践连同源码一起公开了。
 
-> 简单说：**Codex 产品早就有了，但 2026-08-19 才把它的 harness 以平台形式开源。**
+Codex 的哲学可以浓缩成一句话：**可复用的部分是智能体循环（agent loop），仓库即事实来源，AGENTS.md 只是目录页，工程的价值在于设计环境、表达意图、构建反馈循环。**
 
 ## 一句话定位
 
@@ -16,15 +18,17 @@ OpenAI 团队用 Codex 在几周内交付了一个最终上百万行代码的产
 
 ## harness 的价值：ARC-AGI-3 的硬数据
 
-在拆架构之前，先看 OpenAI 用来证明"harness 设计能改变结果"的一组数据（见《[How enabling two settings tripled our scores on the ARC-AGI-3 benchmark](https://openai.com/index/how-two-settings-tripled-our-arc-agi-3-scores/)》，2026 年 7 月）：
+> **信息来源**：以下数据来自 OpenAI 官方博客 [How enabling two settings tripled our scores on the ARC-AGI-3 benchmark](https://openai.com/index/how-two-settings-tripled-our-arc-agi-3-scores/)（2026-07-29）。保留推理和压缩这两项设置在 ChatGPT 和 Codex 中**早已作为默认配置在生产中使用**，但 ARC 官方评估 harness 没有启用。这次对比的目的是说明"harness 设计能改变结果"，而不是 Codex 本身新增了什么。
+
+在拆架构之前，先看 OpenAI 用来证明"harness 设计能改变结果"的一组数据：
 
 在难度极高的 ARC-AGI-3 基准测试中，官方 harness 用了滚动截断（rolling truncation）并丢弃每步的推理过程。OpenAI 只做了两项调整——**保留推理（retained reasoning）** 和 **上下文压缩（compaction）**——GPT-5.6 Sol 的得分就从 **13.3% 飙升到 38.3%**（约 3 倍），同时**输出 token 减少了 6 倍**。
 
 这个结果直接说明了课程的核心论点：评测很少只测模型，它也测了一堆看不见的 API 设置、harness 设计和提示工程。这两项设置（保留推理 + 压缩）正是 Codex 在生产环境里默认部署的方式——好的 harness 设计甚至能让模型脱胎换骨。
 
-## 平台架构：三层集成入口
+## 平台架构：三层集成入口 **[2026-08-19 新]**
 
-Codex 开源后最大的变化是：它不再只是一个 CLI 工具，而是一个可以选择集成深度的平台。OpenAI 官方把集成入口分成三层（见《[Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform)》的 "Choose the right integration layer" 一节）：
+这是 "Codex as a platform" 公告中**新发布的架构**，也是这次开源 commit 的核心内容：Codex 不再只是一个 CLI 工具，而是一个可以选择集成深度的平台。OpenAI 官方把集成入口分成三层（见《[Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform)》的 "Choose the right integration layer" 一节）：
 
 - **`codex exec`（非交互执行）**：跑脚本、CI 任务、一次性后台任务。运行一个有边界的 agent 工作流，返回结构化输出。支持 `--json`（JSON Lines 事件流）、`--output-schema`（按 JSON Schema 约束最终输出）、`--sandbox`（沙箱策略）、`--ephemeral`（不持久化会话）。这是"简单、粗暴、高效"的自动化入口。
 - **Codex SDK（编程式接口）**：支持 TypeScript / Python，用代码启动、恢复或流式传输 Codex 任务。适合需要精准控制线程与任务生命周期的应用程序。
@@ -46,7 +50,7 @@ Codex 开源后最大的变化是：它不再只是一个 CLI 工具，而是一
 
 （详见官方《[Open Source](https://developers.openai.com/codex/open-source)》页面。）
 
-## 指令子系统：AGENTS.md 是目录页，不是百科全书
+## 指令子系统：AGENTS.md 是目录页，不是百科全书 **[一直如此]**
 
 这是 Codex 对 harness 理论最有影响力的一条设计：
 
@@ -58,7 +62,7 @@ Codex 开源后最大的变化是：它不再只是一个 CLI 工具，而是一
 
 配套的原则叫**执行不变量，不要微管实现**（原文："don't micromanage the implementation；focus on invariants"）：AGENTS.md 只写不可违反的硬约束和验证命令，具体怎么实现交给模型。这直接对应课程第二讲"约束而非微操"。
 
-## 上下文子系统：Write-Select-Compress-Isolate
+## 上下文子系统：Write-Select-Compress-Isolate **[一直如此]**
 
 Codex 的上下文工程可以概括为四个策略，这是社区在 "context engineering" 成为独立学科后总结出来再映射回 Codex 的框架（框架出处见 [Context Engineering for Codex CLI](https://codex.danielvaughan.com/2026/06/10/context-engineering-codex-cli-write-select-compress-isolate-june-2026/)）：
 
@@ -69,7 +73,7 @@ Codex 的上下文工程可以概括为四个策略，这是社区在 "context e
 
 社区对 [codex-harness-internals](https://github.com/AlexKenbo/codex-harness-internals) 的源码分析还揭示了一个很细的环境上下文设计：`build_environment_update_item` 只在环境变化时输出**变更字段**（CWD、git 分支、文件系统），而不是每轮都把完整系统上下文粘一遍。这是"上下文里不养重复 token"的工程细节。
 
-## app-server：把智能体循环变成可嵌入的协议
+## app-server：把智能体循环变成可嵌入的协议 **[2026-08-19 新]**
 
 app-server 是这次开源最耀眼的组件。它让 Codex 不再是"你打开的一个工具"，而是"嵌入你产品里的引擎"。它的设计直接体现了"harness 的可复用部分是智能体循环"这一理念。
 
@@ -83,7 +87,7 @@ app-server 是这次开源最耀眼的组件。它让 Codex 不再是"你打开
 
 **生命周期控制。** 连接后先 `initialize` 握手，再 `initialized` 确认；然后 `thread/start` 开会话、`turn/start` 驱动对话、持续读取 stdout 上的通知流（`item/started`、`item/completed`、`item/agen
```

---

### Incident Patch 9: `a49aa744` (2026-08-19)
**Commit Message**: Fix Chinese text leaked into translated harness-designs pages

- Translate alignment tables and reference source headers into de, es,
  fr, ru, tr via codex (previously left in Chinese)
- Remove Chinese diagram glosses from deepseek code blocks across all
  languages (en, ja, ko, pt-BR, uk, uz, vi, ar, de, es, fr, ru, tr)
- Revert ar 2nd-pass edits to keep clean Arabic translations

**File**: `docs/ar/harness-designs/deepseek/index.md` (modified, +4/-4)
```diff
@@ -17,11 +17,11 @@
 يستخدم DeepSeek Harness مفهوم Service للتعبير عن «القدرة»، ويقسّم كل قدرة تقريبًا إلى ثلاث طبقات:
 
 ```
-Service Definition（能力定义）
+Service Definition
         ↓
-Service Provider（能力提供者）
+Service Provider
         ↓
-Consumer（能力消费者）
+Consumer
 ```
 
 لنأخذ نظام الملفات مثالًا: يندرج تحت `FS Service` عدد من Provider مثل Local FS وE2B FS وRemote FS، وتُعرَض جميعها للأعلى بصورة موحّدة على هيئة file tools. وتتبع Shell وSubprocess وSandbox وWeb وLLM وSubAgent البنية نفسها. وهذه البنية الثلاثية ليست خلاصة من عندنا—بل تذكر [وثيقة البنية · Capability seams](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) حرفيًا: *فاصل القدرة هو قدرة قابلة للاستبدال ذات ثلاثة أدوار: Service Definition يعلن الواجهة، وService Provider ينفذها، وConsumer يستخدمها، وغالبًا ما يكون الأخير أداة ظاهرة للنموذج*.
@@ -37,7 +37,7 @@ turn/start → claim input → assemble（system prompt / context / tools）
   → agent/pre-step → step/start → LLM request（agent/request）→ llm/stream
   → assistant/message → tool/call
   → tools/pre-execute（permission / guard / policy / hook）
-  → tools/execute → tools/post-execute → tool/result → step/end → 下一轮
+  → tools/execute → tools/post-execute → tool/result → step/end → next turn
 ```
 
 (المسار أعلاه إعادة صياغة لقسم [وثيقة البنية · Turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md): تمثل `turn/*` و`step/*` و`user/message` و`assistant/*` و`tool/*` أحداث جلسة دائمة، بينما تمثل `agent/pre-step` و`agent/request` و`llm/stream` و`tools/*` نقاط توسعة يمكن للإضافات الاستماع إليها.)
```

**File**: `docs/de/harness-designs/claude-code/index.md` (modified, +6/-6)
```diff
@@ -59,13 +59,13 @@ Claude Codes Logs sind vollständige append-oriented Aufzeichnungen (history.jso
 
 ## Zuordnung zum Kurs-Framework
 
-| 子系统 | Claude Code 的实现 | 评价 |
+| Subsystem | Umsetzung von Claude Code | Bewertung |
 | --- | --- | --- |
-| 指令 | 作用域分层（组织/用户/项目/本地）+ 自动记忆 | 分层记忆是标杆实现 |
-| 工具 | 技能 + MCP + 钩子 + 子智能体四类扩展 | 职责划分清晰，是核心亮点 |
-| 环境 | 项目内设置 + settings.json | 靠用户在 CLAUDE.md 里自描述 |
-| 状态 | 追加式会话存储 + 五层压缩 + resume/fork | 极强，长任务连续性的参考实现 |
-| 反馈 | 权限分类器 + PostToolUse 钩子强制检查 | 把"防提前宣告完成"变成确定性机制 |
+| Anweisungen | Schichtung nach Geltungsbereich (Organisation/Benutzer/Projekt/lokal) + automatisches Memory | Geschichtetes Memory ist eine Referenzimplementierung |
+| Werkzeuge | Skills + MCP + hooks + subagents als vier Erweiterungstypen | Klare Trennung der Verantwortlichkeiten; ein zentraler Pluspunkt |
+| Umgebung | Projekteinstellungen + settings.json | Basiert auf der Selbstbeschreibung des Benutzers in CLAUDE.md |
+| Zustand | Append-only session-Speicher + fünfstufige compaction + resume/fork | Sehr stark; eine Referenzimplementierung für die Kontinuität lang laufender Aufgaben |
+| Feedback | Permission-Klassifikator + durch PostToolUse-hooks erzwungene Prüfungen | Macht die Verhinderung verfrühter Fertigmeldungen zu einem deterministischen Mechanismus |
 
 ## Übernehmenswerte Designs
 
```

**File**: `docs/de/harness-designs/codex/index.md` (modified, +6/-6)
```diff
@@ -47,13 +47,13 @@ Approval Policies und Plan Mode bilden die andere Seite des Feedbacks: Vor risik
 
 ## Zuordnung zum Kurs-Framework
 
-| 子系统 | Codex 的实现 | 评价 |
+| Subsystem | Umsetzung von Codex | Bewertung |
 | --- | --- | --- |
-| 指令 | AGENTS.md 目录页 + docs/ 拆分 + 执行不变量 | 教科书级，定义了"给地图不给说明书" |
-| 工具 | worktree 隔离 + spawn_agent 子智能体 | 边界靠环境硬隔离，很强 |
-| 环境 | 独立 worktree + 可观测性栈 | worktree 隔离是其招牌 |
-| 状态 | Write 策略（状态写进文件/文档） | 依赖约定而非内建记忆 |
-| 反馈 | 验证命令入规范 + 审批策略 + plan mode | 反馈路径默认化，值得抄 |
+| Anweisungen | AGENTS.md als Verzeichnisseite + Aufteilung in docs/ + Ausführungsinvarianten | Lehrbuchreif; definiert das Prinzip „eine Karte, keine Anleitung“ |
+| Werkzeuge | worktree-Isolation + spawn_agent-subagents | Grenzen werden durch harte Umgebungsisolation durchgesetzt; sehr stark |
+| Umgebung | Eigener worktree + Observability-Stack | worktree-Isolation ist das Markenzeichen |
+| Zustand | Write-Strategie (Zustand wird in Dateien/Dokumente geschrieben) | Beruht auf Konventionen statt auf integriertem Memory |
+| Feedback | Validierungsbefehle in der Spezifikation + Approval Policies + plan mode | Der Feedbackpfad ist standardmäßig vorgesehen; nachahmenswert |
 
 Der Vergleich zwischen Codex und Claude Code ist aufschlussreich: Claude Code verfolgt „Addition“ – Memory, permissions und subagents werden in den Kernel eingebaut. Codex verfolgt „Subtraktion“ – der Kernel bleibt möglichst zurückhaltend, während mehr Verantwortung bei Repository-Konventionen und Context Engineering liegt. Deshalb heißt es in der Community oft: „Die harness-Philosophie von Codex ist wertvoller als sein Code.“
 
```

**File**: `docs/de/harness-designs/deepseek/index.md` (modified, +10/-10)
```diff
@@ -17,11 +17,11 @@ Das ist die konsequenteste Umsetzung des Kurssatzes „Alles außerhalb der Mode
 DeepSeek Harness stellt „Fähigkeiten“ als Services dar; fast jede Fähigkeit ist in drei Ebenen aufgeteilt:
 
 ```
-Service Definition（能力定义）
+Service Definition
         ↓
-Service Provider（能力提供者）
+Service Provider
         ↓
-Consumer（能力消费者）
+Consumer
 ```
 
 Am Beispiel des Dateisystems: Unter dem `FS Service` stehen mehrere Provider wie Local FS, E2B FS und Remote FS, die nach oben einheitlich als file tools exponiert werden. Shell, Subprocess, Sandbox, Web, LLM und SubAgent folgen derselben Struktur. Diese Dreiteilung ist keine Zusammenfassung von uns. Die [Architekturdokumentation · Capability seams](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) sagt: *a seam is a swappable capability with three roles: a Service Definition declaring the interface, a Service Provider implementing it, and a Consumer using it, commonly a model-facing tool* (Ein Capability Seam ist eine austauschbare Fähigkeit mit drei Rollen: einer Service Definition, die das Interface deklariert, einem Service Provider, der es implementiert, und einem Consumer, der es verwendet – üblicherweise ein dem Modell zugängliches Tool).
@@ -37,7 +37,7 @@ turn/start → claim input → assemble（system prompt / context / tools）
   → agent/pre-step → step/start → LLM request（agent/request）→ llm/stream
   → assistant/message → tool/call
   → tools/pre-execute（permission / guard / policy / hook）
-  → tools/execute → tools/post-execute → tool/result → step/end → 下一轮
+  → tools/execute → tools/post-execute → tool/result → step/end → next turn
 ```
 
 (Die obige Pipeline ist eine Wiedergabe des Abschnitts [Architekturdokumentation · Turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md): `turn/*`, `step/*`, `user/message`, `assistant/*` und `tool/*` sind persistierte session-Events; `agent/pre-step`, `agent/request`, `llm/stream` und `tools/*` sind Erweiterungspunkte, die plugins beobachten können.)
@@ -58,13 +58,13 @@ Mit anderen Worten: Observability ist kein nachträglich ergänztes Logging, son
 
 ## Zuordnung zum Kurs-Framework
 
-| 子系统 | DeepSeek Harness 的实现 | 评价 |
+| Subsystem | Umsetzung von DeepSeek Harness | Bewertung |
 | --- | --- | --- |
-| 指令 | 插件化；规则/技能均以插件形态注入 | 极自由，但没有内置的"CLAUDE.md"式惯例 |
-| 工具 | Service Definition → Provider → Consumer 能力接缝 | 工具子系统标准化的极致 |
-| 环境 | 沙箱/FS/Shell 全部可换 Provider（含远程 E2B） | 环境彻底可插拔 |
-| 状态 | append-only Session Event Log + Model-visible means logged | 可观测性是第一性约束 |
-| 反馈 | tools/pre-execute 上的 permission / guard / policy / hook | 反馈机制事件化 |
+| Anweisungen | Pluginbasiert; Regeln und Skills werden als plugins injiziert | Maximale Freiheit, aber keine integrierte Konvention nach Art von CLAUDE.md |
+| Werkzeuge | Service Definition → Provider → Consumer als Capability Seam | Konsequente Standardisierung des Werkzeugsubsystems |
+| Umgebung | Provider für Sandbox/FS/Shell sind vollständig austauschbar (einschließlich Remote-E2B) | Die Umgebung ist vollständig austauschbar |
+| Zustand | append-only Session Event Log + Model-visible means logged | Observability ist ein Constraint erster Ordnung |
+| Feedback | permission / guard / policy / hook auf tools/pre-execute | Der Feedbackmechanismus ist ereignisbasiert |
 
 Der grundlegende Unterschied zwischen DeepSeek Harness und den drei anderen Produkten: Pi, Claude Code und Codex optimieren den harness jeweils „innerhalb eines bestimmten agent“. DeepSeek Harness definiert den harness dagegen als **modellunabhängiges Betriebssystem**; der agent selbst ist nur eine austauschbare Anwendung auf diesem OS. Der Preis ist offensichtlich: Hohe Freiheit verursacht hohen Konfigurationsaufwand. Das ist die unvermeidliche Kehrseite des Designs „harness als OS“ – und in der Developer Preview lautet die Positionierung ohnehin „früh ausprobieren, während sich die Mechanismen noch entwickeln“.
 
```

**File**: `docs/de/harness-designs/pi/index.md` (modified, +6/-6)
```diff
@@ -63,13 +63,13 @@ Dasselbe Community-Repository bestätigt dieses Muster weiter: `VISION.md` (Ziel
 
 Bewertung von Pi anhand der fünf Subsysteme des Kurses (subjektiv, zum Vergleich):
 
-| 子系统 | Pi 的实现 | 评价 |
+| Subsystem | Umsetzung von Pi | Bewertung |
 | --- | --- | --- |
-| 指令 | AGENTS.md 分级加载 + SYSTEM.md | 层级清晰，但规则本身要靠用户写 |
-| 工具 | 技能按需加载 + 扩展全生命周期钩子 | 极强，把工具系统做成了可编程面 |
-| 环境 | SYSTEM.md 做环境自描述；运行时环境靠用户在 AGENTS.md 里声明 | 机制是开放的，但可复现性依赖用户自述 |
-| 状态 | 会话树 + 压缩可定制 + PROGRESS.md | 极强，跨会话与可恢复性是其核心 |
-| 反馈 | 验证命令靠用户定义；session-summary / extract-patterns 机制化 | 机制提供，内容靠用户 |
+| Anweisungen | Abgestuftes Laden von AGENTS.md + SYSTEM.md | Klare Hierarchie, die Regeln selbst müssen jedoch vom Benutzer verfasst werden |
+| Werkzeuge | Laden von Skills bei Bedarf + hooks für den gesamten Lebenszyklus von Extensions | Sehr stark; macht das Werkzeugsystem zu einer programmierbaren Oberfläche |
+| Umgebung | SYSTEM.md zur Selbstbeschreibung der Umgebung; die Runtime-Umgebung wird vom Benutzer in AGENTS.md deklariert | Der Mechanismus ist offen, die Reproduzierbarkeit hängt jedoch von der Selbstbeschreibung des Benutzers ab |
+| Zustand | session tree + anpassbare compaction + PROGRESS.md | Sehr stark; session-übergreifende Kontinuität und Wiederherstellbarkeit bilden den Kern |
+| Feedback | Validierungsbefehle werden vom Benutzer definiert; session-summary / extract-patterns sind als Mechanismen umgesetzt | Der Mechanismus wird bereitgestellt, der Inhalt kommt vom Benutzer |
 
 Pis Trade-offs stehen in scharfem Kontrast zu Claude Code und Codex: Claude Code baut „Memory, permissions und subagents“ gebrauchsfertig in den Kernel ein; Codex macht „Repository-Konventionen und Umgebungsisolation“ zum Standard. Pi entscheidet sich dafür, **nichts an deiner Stelle zu entscheiden** – es macht die Entscheidungshoheit zu Erweiterungspunkten. Der Preis: Du musst Extensions entweder selbst schreiben oder Pakete anderer installieren.
 
```

**File**: `docs/en/harness-designs/deepseek/index.md` (modified, +4/-4)
```diff
@@ -17,11 +17,11 @@ This is the most thorough implementation of the course's statement that "everyth
 DeepSeek Harness represents "capabilities" as Services, and divides nearly every capability into three layers:
 
 ```
-Service Definition（能力定义）
+Service Definition
         ↓
-Service Provider（能力提供者）
+Service Provider
         ↓
-Consumer（能力消费者）
+Consumer
 ```
 
 Take the file system as an example: under `FS Service` are multiple Providers—Local FS, E2B FS, and Remote FS—all exposed upward through a consistent set of file tools. Shell, Subprocess, Sandbox, Web, LLM, and SubAgent follow the same structure. This three-layer structure is not our own summary. The [architecture documentation · Capability seams](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) says: *a seam is a swappable capability with three roles: a Service Definition declaring the interface, a Service Provider implementing it, and a Consumer using it, commonly a model-facing tool*.
@@ -37,7 +37,7 @@ turn/start → claim input → assemble（system prompt / context / tools）
   → agent/pre-step → step/start → LLM request（agent/request）→ llm/stream
   → assistant/message → tool/call
   → tools/pre-execute（permission / guard / policy / hook）
-  → tools/execute → tools/post-execute → tool/result → step/end → 下一轮
+  → tools/execute → tools/post-execute → tool/result → step/end → next turn
 ```
 
 (The pipeline above is adapted from the [architecture documentation · Turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md): `turn/*`, `step/*`, `user/message`, `assistant/*`, and `tool/*` are persistent session events, while `agent/pre-step`, `agent/request`, `llm/stream`, and `tools/*` are extension points that plugins can observe.)
```

**File**: `docs/es/harness-designs/claude-code/index.md` (modified, +6/-6)
```diff
@@ -59,13 +59,13 @@ Los logs de Claude Code son registros completos append-only en history.jsonl. Ju
 
 ## Correspondencia con el marco del curso
 
-| 子系统 | Claude Code 的实现 | 评价 |
+| Subsistema | Implementación de Claude Code | Evaluación |
 | --- | --- | --- |
-| 指令 | 作用域分层（组织/用户/项目/本地）+ 自动记忆 | 分层记忆是标杆实现 |
-| 工具 | 技能 + MCP + 钩子 + 子智能体四类扩展 | 职责划分清晰，是核心亮点 |
-| 环境 | 项目内设置 + settings.json | 靠用户在 CLAUDE.md 里自描述 |
-| 状态 | 追加式会话存储 + 五层压缩 + resume/fork | 极强，长任务连续性的参考实现 |
-| 反馈 | 权限分类器 + PostToolUse 钩子强制检查 | 把"防提前宣告完成"变成确定性机制 |
+| Instrucciones | Ámbitos por capas (organización/usuario/proyecto/local) + auto memory | La memoria por capas es la implementación de referencia |
+| Herramientas | Cuatro tipos de extensión: Skills + MCP + hooks + subagents | La separación clara de responsabilidades es una fortaleza esencial |
+| Entorno | Ajustes dentro del proyecto + settings.json | Depende de que los usuarios describan el entorno en CLAUDE.md |
+| Estado | Almacenamiento append-only de sessions + compaction de cinco niveles + resume/fork | Muy potente; una implementación de referencia para la continuidad de tareas largas |
+| Retroalimentación | Clasificador de permissions + comprobaciones obligatorias mediante hooks PostToolUse | Convierte la «prevención de declaraciones prematuras de finalización» en un mecanismo determinista |
 
 ## Diseños que merece la pena adoptar
 
```

**File**: `docs/es/harness-designs/codex/index.md` (modified, +6/-6)
```diff
@@ -47,13 +47,13 @@ Las approval policies y plan mode llevan la retroalimentación en otra direcció
 
 ## Correspondencia con el marco del curso
 
-| 子系统 | Codex 的实现 | 评价 |
+| Subsistema | Implementación de Codex | Evaluación |
 | --- | --- | --- |
-| 指令 | AGENTS.md 目录页 + docs/ 拆分 + 执行不变量 | 教科书级，定义了"给地图不给说明书" |
-| 工具 | worktree 隔离 + spawn_agent 子智能体 | 边界靠环境硬隔离，很强 |
-| 环境 | 独立 worktree + 可观测性栈 | worktree 隔离是其招牌 |
-| 状态 | Write 策略（状态写进文件/文档） | 依赖约定而非内建记忆 |
-| 反馈 | 验证命令入规范 + 审批策略 + plan mode | 反馈路径默认化，值得抄 |
+| Instrucciones | AGENTS.md como página de índice + división en docs/ + invariantes impuestos | De manual; define «dar el mapa, no el manual» |
+| Herramientas | Aislamiento mediante worktree + subagents con spawn_agent | Límites sólidos impuestos mediante el aislamiento del entorno |
+| Entorno | Worktrees independientes + stack de observabilidad | El aislamiento mediante worktree es su seña distintiva |
+| Estado | Estrategia Write (el estado se escribe en archivos/documentación) | Depende de convenciones en lugar de memoria integrada |
+| Retroalimentación | Comandos de verificación en la especificación + approval policies + plan mode | Convierte las rutas de retroalimentación en la opción predeterminada; merece la pena adoptarlo |
 
 La comparación entre Codex y Claude Code es interesante: Claude Code aplica la «adición», integrando en el núcleo memoria, permissions y subagents; Codex aplica la «sustracción», mantiene el núcleo lo más contenido posible y deposita más responsabilidad en las convenciones del repositorio y la ingeniería de contexto. Por eso la comunidad suele decir que «la filosofía del harness de Codex vale más que su código».
 
```

---

### Incident Patch 10: `260a3993` (2026-08-19)
**Commit Message**: Translate 前沿 Harness 拆解 column to all 15 languages and fix Discord link

- Add harness-designs translation files for ar, de, en, es, fr, ja, ko,
  pt-BR, ru, tr, uk, uz, vi, zh-TW (5 pages each: overview, Pi, Claude
  Code, Codex, DeepSeek)
- Wire harness-designs nav/sidebar in config.mts for all locales
- Add column cards to every language homepage
- Point Discord community link to https://github.com/walkinglabs

**File**: `README.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
   <img src="https://img.shields.io/badge/Projects-8-green?style=flat-square" alt="8 Projects">
   <img src="https://img.shields.io/badge/Languages-15-yellow?style=flat-square" alt="15 Languages">
   <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="MIT License">
-  <a href="https://discord.gg/XU7DQmpqk"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Join the Discord community"></a>
+  <a href="https://github.com/walkinglabs"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Join the Discord community"></a>
 </p>
 
 > 🌍 This course is available in **15 languages**: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Русский, Deutsch, العربية, Tiếng Việt, Oʻzbekcha, Türkçe, Portuguese (BR), Українська. Choose your language from the badges above.
```

**File**: `docs-readme/uk-UA/README.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
   <img src="https://img.shields.io/badge/Projects-8-green?style=flat-square" alt="8 проєктів">
   <img src="https://img.shields.io/badge/Languages-15-yellow?style=flat-square" alt="15 мов">
   <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="Ліцензія MIT">
-  <a href="https://discord.gg/XU7DQmpqk"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Приєднатися до спільноти в Discord"></a>
+  <a href="https://github.com/walkinglabs"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Приєднатися до спільноти в Discord"></a>
 </p>
 
 > 🌍 Цей курс доступний **15 мовами**: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Русский, Deutsch, العربية, Tiếng Việt, Oʻzbekcha, Türkçe, Portuguese (BR), Українська. Оберіть свою мову за допомогою значків вище.
```

**File**: `docs/.vitepress/config.mts` (modified, +168/-14)
```diff
@@ -5,11 +5,12 @@ import { withMermaid } from "vitepress-plugin-mermaid";
 const docsBase = "/learn-harness-engineering/";
 const brandLogo = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23D95C41" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12.1" y1="11.9" x2="18.9" y2="8.2" /><line x1="12.1" y1="12.1" x2="20.3" y2="12.9" /><line x1="12.2" y1="12.4" x2="16.6" y2="19.1" /><line x1="11.8" y1="12.4" x2="7.3" y2="19.2" /><line x1="11.9" y1="12.1" x2="3.7" y2="13.3" /><line x1="11.8" y1="11.7" x2="7.8" y2="4.4" /></svg>';
 const githubRepoTreeLink = "https://github.com/walkinglabs/learn-harness-engineering/tree/main";
-const discordInviteLink = "https://discord.gg/XU7DQmpqk";
-const socialLinks = [
+// Discord 邀请链接会过期，社区入口默认指向组织主页
+const communityLink = "https://github.com/walkinglabs";
+const socialLinks: Array<{ icon: "github" | "discord"; link: string }> = [
   { icon: "github", link: githubRepoTreeLink },
-  { icon: "discord", link: discordInviteLink }
-] as const;
+  { icon: "discord", link: communityLink }
+];
 
 const zhLectureItems = [
   { text: "欢迎", link: "/zh/" },
@@ -60,6 +61,14 @@ const zhHarnessDesignItems = [
   { text: "拆解 DeepSeek Harness 的设计", link: "/zh/harness-designs/deepseek/" }
 ];
 
+const enHarnessDesignItems = [
+  { text: "Frontier Harness Design Breakdowns", link: "/en/harness-designs/" },
+  { text: "Breaking Down Pi's Harness Design", link: "/en/harness-designs/pi/" },
+  { text: "Breaking Down Claude Code's Harness Design", link: "/en/harness-designs/claude-code/" },
+  { text: "Breaking Down Codex's Harness Design", link: "/en/harness-designs/codex/" },
+  { text: "Breaking Down DeepSeek Harness's Design", link: "/en/harness-designs/deepseek/" }
+];
+
 const enLectureItems = [
   { text: "Welcome", link: "/en/" },
   { text: "Why Capable Agents Still Fail", link: "/en/lectures/lecture-01-why-capable-agents-still-fail/" },
@@ -144,6 +153,22 @@ const viSkillItems = [
   { text: "Tổng quan về Kỹ năng", link: "/vi/skills/" },
 ];
 
+const viHarnessDesignItems = [
+  { text: "Phân tích các harness tiên tiến", link: "/vi/harness-designs/" },
+  { text: "Phân tích thiết kế harness của Pi", link: "/vi/harness-designs/pi/" },
+  { text: "Phân tích thiết kế harness của Claude Code", link: "/vi/harness-designs/claude-code/" },
+  { text: "Phân tích thiết kế harness của Codex", link: "/vi/harness-designs/codex/" },
+  { text: "Phân tích thiết kế DeepSeek Harness", link: "/vi/harness-designs/deepseek/" }
+];
+
+const ruHarnessDesignItems = [
+  { text: "Разбор передовых harness", link: "/ru/harness-designs/" },
+  { text: "Разбор дизайна harness в Pi", link: "/ru/harness-designs/pi/" },
+  { text: "Разбор дизайна harness в Claude Code", link: "/ru/harness-designs/claude-code/" },
+  { text: "Разбор дизайна harness в Codex", link: "/ru/harness-designs/codex/" },
+  { text: "Разбор дизайна DeepSeek Harness", link: "/ru/harness-designs/deepseek/" }
+];
+
 const ruLectureItems = [
   { text: "Добро пожаловать", link: "/ru/" },
   { text: "Сильная модель ≠ надёжное исполнение", link: "/ru/lectures/lecture-01-why-capable-agents-still-fail/" },
@@ -230,6 +255,22 @@ const uzSkillItems = [
   { text: "Malakalar umumiy koʻrinishi", link: "/uz/skills/" },
 ];
 
+const uzHarnessDesignItems = [
+  { text: "Ilgʻor harness dizaynlari tahlili", link: "/uz/harness-designs/" },
+  { text: "Pi harness dizayni tahlili", link: "/uz/harness-designs/pi/" },
+  { text: "Claude Code harness dizayni tahlili", link: "/uz/harness-designs/claude-code/" },
+  { text: "Codex harness dizayni tahlili", link: "/uz/harness-designs/codex/" },
+  { text: "DeepSeek Harness dizayni tahlili", link: "/uz/harness-designs/deepseek/" }
+];
+
+const koHarnessDesignItems = [
+  { text: "최전선 Harness 분석", link: "/ko/harness-designs/" },
+  { text: "Pi의 harness 설계 분석", link: "/ko/harness-designs/pi/" },
+  { text: "Claude Code의 harness 설계 분석", link: "/ko/harness-designs/claude-code/" },
+  { text: "Codex의 harness 설계 분석", link: "/ko/harness-designs/codex/" },
+  { text: "DeepSeek Harness 설계 분석", link: "/ko/harness-designs/deepseek/" }
+];
+
 const koLectureItems = [
   { text: "환영합니다", link: "/ko/" },
   { text: "유능한 에이전트가 여전히 실패하는 이유", link: "/ko/lectures/lecture-01-why-capable-agents-still-fail/" },
@@ -275,6 +316,14 @@ const koSkillItems = [
   { text: "스킬 개요", link: "/ko/skills/" },
 ];
 
+const jaHarnessDesignItems = [
+  { text: "最前線の Harness 設計を読み解く", link: "/ja/harness-designs/" },
+  { text: "Pi の harness 設計を読み解く", link: "/ja/harness-designs/pi/" },
+  { text: "Claude Code の harness 設計を読み解く", link: "/ja/harness-designs/claude-code/" },
+  { text: "Codex の harness 設計を読み解く", link: "/ja/harness-designs/codex/" },
+  { text: "DeepSeek Harness の設計を読み解く", link: "/ja/harness-designs/deepseek/" }
+];
+
 const jaLectureItems = [
   { text: "ようこそ", link: "/ja/" },
   { text: "強いモデルは信頼できる実行を意味しない", link: "/ja/lectures/lecture-01-why-capable-agents-stil
```

**File**: `docs/ar/harness-designs/claude-code/index.md` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+# تحليل تصميم harness في Claude Code
+
+توضح Anthropic في مقال [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) أن مصدر الموثوقية هو harness لا النموذج، وأن الـ agent يحتاج إلى قيود «خارج النموذج». ويعد Claude Code التجسيد العملي لهذه الفكرة؛ إذ تصنّفه Anthropic رسميًا ضمن فئة **agentic harness**. وليس ذلك شعارًا تسويقيًا—فلعل Claude Code أكثر harness جرى تحليله علنًا حتى الآن: شيفرته المصدرية مفتوحة، وتقارير المجتمع البحثية عنه مفصلة، كما حوّل معظم الآليات الجوهرية في محاضرات الدورة (الذاكرة الطبقية، وcompaction السياق، وpermissions، وhooks، وsubagents، واستمرارية session) إلى تطبيق متكامل على مستوى المنتج.
+
+نحلل في هذه المقالة Claude Code باستخدام إطار الأنظمة الفرعية الخمسة في الدورة، مع التركيز على كيفية تطبيقه مفاهيم harness الأساسية مثل «إدارة السياق» و«منع إعلان الإنجاز مبكرًا» و«القيود الحتمية».
+
+## التعريف في جملة واحدة
+
+جوهر Claude Code حلقة while بسيطة: استدعاء النموذج، وتنفيذ الأدوات، وملاحظة النتائج، ثم استدعاء النموذج مجددًا. لكن **الغالبية الساحقة من الشيفرة ليست داخل هذه الحلقة، بل في النظام المحيط بها**—نظام permissions، ومسار compaction للسياق، وآليات التوسعة، وتنسيق subagents، وتخزين session. وهذه هي ماهية harness: الحلقة هي الهيكل العظمي، وما يقع خارجها هو ما يحدد الموثوقية.
+
+## النظام الفرعي للتعليمات: منظومة ذاكرة طبقية
+
+يمثل نظام الذاكرة في Claude Code إسهامه الأكثر مباشرة في نظرية harness، وهو يقابل محاضرتي «المستودع هو مصدر الحقيقة» و«استمرارية السياق عبر sessions» في الدورة. توضح [الوثيقة الرسمية «How Claude remembers your project»](https://code.claude.com/docs/en/memory) أن كل session يبدأ بنافذة سياق جديدة تمامًا، وأن المعرفة تنتقل بين sessions بواسطة آليتين: ملفات CLAUDE.md (التعليمات التي تكتبها) وauto memory (الملاحظات التي يكتبها Claude بنفسه).
+
+ومن حيث النطاق، تقسم الوثائق الرسمية ملفات CLAUDE.md إلى أربع فئات (بترتيب التحميل من الأوسع إلى الأضيق):
+
+- **مستوى سياسة المؤسسة**: تديره فرق IT/DevOps مركزيًا (مثل `/etc/claude-code/CLAUDE.md`) لقواعد المؤسسة.
+- **مستوى المستخدم `~/.claude/CLAUDE.md`**: التفضيلات والقواعد الشخصية العابرة للمشروعات.
+- **مستوى المشروع `./CLAUDE.md` أو `./.claude/CLAUDE.md`**: مصدر الحقيقة للمشروع، ويشمل بنية المشروع، والمكدس التقني، وأوامر التحقق، ويُشارك مع المستودع.
+- **المستوى المحلي `./CLAUDE.local.md`**: التفضيلات الشخصية داخل المشروع، ويضاف عادة إلى `.gitignore` ولا يُعتمد.
+
+وتوجد آليتان إضافيتان:
+
+- **التحميل عند الطلب على مستوى الدليل الفرعي**: لا تُحمّل ملفات CLAUDE.md في الأدلة الفرعية عند بدء التشغيل، بل تدخل السياق عندما يقرأ Claude ملفًا في ذلك الدليل.
+- **الذاكرة التلقائية (auto memory)**: يكتب Claude ملاحظات بصورة استباقية بناءً على تصحيحاتك وتفضيلاتك؛ وتُشارك على مستوى المستودع وتعمل عبر worktree، مع تحميل أول 200 سطر أو 25KB كحد أقصى في كل session.
+
+تشكل هذه النطاقات الأربعة **تدرجًا للتعليمات**: تقول الوثائق الرسمية إن «التعليمات الأكثر تحديدًا تدخل السياق في وقت لاحق» (فتظهر تعليمات المشروع بعد تعليمات المستخدم). وتكمن القيمة في ألّا يُجبر النموذج على استيعاب ملف تعليمات ضخم كامل في بداية كل محادثة، بل تُحمّل التعليمات محليًا بحسب نطاقها. وهذا هو الجواب العملي عن سؤال المحاضرة الرابعة: «لماذا يفشل ملف التعليمات العملاق الواحد؟».
+
+## النظام الفرعي للسياق: مسار compaction من خمس طبقات
+
+تدير Claude Code السياق عبر **مسار compaction من خمس طبقات** (five-layer compaction pipeline)، لا بمجرد «التلخيص عند الامتلاء»—وتأتي هذه التفصيلة البنيوية من تحليل الشيفرة المصدرية في تقرير [VILA Lab‏ «Dive into Claude Code»](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf). تشرح المحاضرة الخامسة أن «المهام الطويلة تفقد الاستمرارية»، وحل Claude Code هو قمع متعدد المراحل: يبدأ بالتقليم غير الفاقد (إزالة نتائج الأدوات الزائدة)، ثم الاستخلاص المنظم، ولا يلجأ إلى تلخيص LLM الفاقد إلا في النهاية، مع آلية قاطع دائرة تمنع compaction المفرط.
+
+ويكمل ذلك تصميم تخزين session: **تخزين session موجّه إلى الإلحاق (append-oriented storage)**، تُلحق فيه كل السجلات بـ `history.jsonl`، مع دعم الاستئناف عبر `/resume` والتفرع fork. وهذا يضمن «إجراء تسليم جيد قبل نهاية كل session»—لا بفضل ذاكرة قوية، بل لأن طبقة التخزين إلحاقية وقابلة لإعادة التشغيل.
+
+## النظام الفرعي للأدوات: أربع آليات للتوسعة
+
+يقسّم Claude Code سطح التوسعة إلى أربع فئات، تعالج كل منها نوعًا مختلفًا من المشكلات، وهذا أكثر ما يستحق الاقتباس في تصميمه:
+
+- **Skills**: تعرفها [الوثائق الرسمية](https://code.claude.com/docs/en/skills) بأنها معرفة إجرائية يصفها `SKILL.md`، وتُحمّل تلقائيًا وفق كلمات التشغيل، مع إفصاح تدريجي. وهي ملائمة لمعرفة المجال المتعلقة بـ «كيفية تنفيذ شيء ما».
+- **MCP**: يربط بروتوكول JSON-RPC الوارد في [الوثائق الرسمية](https://code.claude.com/docs/en/mcp) الأنظمة الخارجية، وهو الواجهة القياسية التي «تمد يد النموذج إلى العالم الخارجي».
+- **Hooks**: نصوص حتمية تعلّقها [الوثائق الرسمية](https://code.claude.com/docs/en/hooks) بأحداث دورة الحياة مثل `PreToolUse` و`PostToolUse` و`Stop`.
+- **Plugins / Subagents**: توكل [الوثائق الرسمية](https://code.claude.com/docs/en/sub-agents) المهام المعقدة إلى agent متخصص.
+
+قرار التصميم الأسا
```

**File**: `docs/ar/harness-designs/codex/index.md` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# تحليل تصميم harness في Codex
+
+لعل [Codex](https://openai.com/index/harness-engineering/) من OpenAI أكثر المنتجات الأربعة ارتباطًا بـ «أصول harness»—فمقال «Harness Engineering» الذي منح المجال كله اسمه، هو في حد ذاته خلاصة خبرة فريق OpenAI في بناء منتج باستخدام Codex. لذلك فإن تحليل تصميم harness في Codex هو، إلى حد بعيد، تحليل للممارسات الهندسية الكامنة وراء ذلك المقال.
+
+يمكن تلخيص فلسفة Codex في جملة واحدة: **المستودع هو مصدر الحقيقة (repository as the system of record)، وAGENTS.md مجرد صفحة فهرس، وتكمن قيمة الهندسة في تصميم البيئة، والتعبير عن المقصد، وبناء حلقات التغذية الراجعة.**
+
+## التعريف في جملة واحدة
+
+استخدم فريق OpenAI‏ Codex لتسليم منتج بلغ في النهاية أكثر من مليون سطر من الشيفرة خلال بضعة أسابيع، و**كتب Codex كل سطر منها** (راجع قسم «Designing for growth» في [Harness Engineering](https://openai.com/index/harness-engineering/)). وتجيب تجربتهم عن سؤال: كيف ينبغي تنظيم النظام عندما يتحول دور المهندس من «كتابة الشيفرة» إلى «تصميم harness»؟ أما Codex CLI نفسه فهو ملف تنفيذي أحادي مفتوح المصدر (منفذ بلغة Rust، في [github.com/openai/codex](https://github.com/openai/codex))، لكن إسهامه في harness يتمحور أساسًا حول **الأعراف (convention)** و**هندسة السياق**، لا حول نقاط توسعة براقة.
+
+## النظام الفرعي للتعليمات: AGENTS.md صفحة فهرس لا موسوعة
+
+هذه أكثر أفكار Codex تأثيرًا في نظرية harness:
+
+> لا يسهل فحص ملف تعليمات عملاق واحد آليًا (من حيث التغطية، وحالة التحديث، والملكية، والروابط المتقاطعة)، ولا يمكن تجنب ابتعاده عن الواقع. لذلك لم نعد نتعامل مع AGENTS.md بوصفه موسوعة، بل بوصفه **صفحة فهرس**. وتوجد معرفة قاعدة الشيفرة في وثائق منظمة، بينما يشير AGENTS.md إليها.
+
+(ما سبق نقل مباشر بالمعنى لقسم «AGENTS.md should be a directory page» في النص الأصلي لمقال [Harness Engineering](https://openai.com/index/harness-engineering/).)
+
+تقول المحاضرة الرابعة إن «ملف التعليمات العملاق الواحد يفشل»، ويقدم Codex الحل الصحيح مباشرة: أبقِ AGENTS.md في حدود 100 سطر تقريبًا (يوصي النص الأصلي بنحو 100 سطر، وانقله إلى `docs/` عند الاقتراب من الحد)، وقسّم ما لا يتسع له إلى دليل `docs/` ليقرأه الـ agent عند الطلب. وهذا هو المصدر الموثوق لعبارة «قدّم خريطة، لا دليل تعليمات».
+
+ويسمى المبدأ المصاحب **فرض الثوابت بدل الإدارة الدقيقة للتنفيذ** (في النص الأصلي: "don't micromanage the implementation；focus on invariants"): لا يُكتب في AGENTS.md سوى القيود الصلبة التي لا يجوز انتهاكها وأوامر التحقق، ويُترك للنموذج تقرير كيفية التنفيذ. وهذا يقابل مباشرة «القيود لا الإدارة الدقيقة» في المحاضرة الثانية.
+
+## النظام الفرعي للسياق: Write-Select-Compress-Isolate
+
+يمكن تلخيص هندسة السياق في Codex بأربع استراتيجيات. وقد صاغ المجتمع هذا الإطار بعد أن أصبحت «هندسة السياق» مجالًا مستقلًا، ثم واءمه مع Codex (راجع مصدر الإطار [Context Engineering for Codex CLI](https://codex.danielvaughan.com/2026/06/10/context-engineering-codex-cli-write-select-compress-isolate-june-2026/)):
+
+- **Write (الكتابة إلى الخارج)**: حفظ السياق خارج النافذة—تُكتب الاستنتاجات في الوثائق، والحالة في الملفات، بدل إبقائها في المحادثة. ويقابل ذلك «المستودع هو مصدر الحقيقة».
+- **Select (الانتقاء إلى الداخل)**: إدخال الـ token المطلوبة فقط إلى النافذة—يشير AGENTS.md إلى الطريق، وتُقرأ الملفات عند الطلب، بدل حشر المستودع كله فيها.
+- **Compress (compaction)**: الاحتفاظ بما يهم فعلًا—يتضمن Codex compaction تلقائيًا وأمر `/compact` يدويًا، ويمكن تخصيص `compact_prompt` (راجع [Context Engineering for Codex CLI](https://codex.danielvaughan.com/2026/06/10/context-engineering-codex-cli-write-select-compress-isolate-june-2026/)).
+- **Isolate (العزل)**: تقسيم السياق إلى حدود مختلفة—استخدام subagent لعزل سياق كل مهمة، بحيث لا يرى subagent الواجهة الأمامية مخطط قاعدة بيانات الواجهة الخلفية مطلقًا.
+
+ولدى Codex تفصيلة دقيقة في تصميم سياق البيئة: يوضح تحليل المجتمع للشيفرة المصدرية في [codex-harness-internals](https://github.com/AlexKenbo/codex-harness-internals) أن `build_environment_update_item` لا يخرج إلا **الحقول المتغيرة** (CWD، وفرع git، ونظام الملفات) عند تغير البيئة، بدل لصق سياق النظام كاملًا في كل جولة. وهذه تفصيلة هندسية تحقق مبدأ «عدم الاحتفاظ بـ token مكررة في السياق».
+
+## الأدوات والحدود: عزل worktree + subagents
+
+لدى Codex آليتان جوهريتان في harness:
+
+**1. عزل البيئة بواسطة git worktree.** يوضح قسم «Environment» في النص الأصلي لمقال [Harness Engineering](https://openai.com/index/harness-engineering/) أن كل مهمة تعمل في git worktree مستقل، مع مكدس محلي لقابلية الرصد (السجلات، والمقاييس، والتتبعات)، كي يُتحقق من كل تغيير في بيئة مستقلة. وهذا هو التطبيق المادي للمحاضرة السابعة «وضع حدود واضحة لكل مهمة agent»—فالحدود لا تعتمد على التوسل في التعليمات، بل تفرضها عزلة البيئة. وهنا يتحول النظام الفرعي للبيئة (environment) إلى عزل صلب.
+
+**2. subagents على مستوى النواة.** أداتا `spawn_agent` و`wait_agent` في Codex أداتان على مستوى النواة: ينشئ النموذج subagent صراحة، ويمنحه سجل session ومجموعة أدوات مستقلين، ثم ينتظر النتيجة. يرث subagent تعليمات AGENTS.md من الأب، لكنه يعمل في **سياقه الخاص**. ويوضع الإعداد في `.codex/agents/*.toml`، مع إمكان تحديد نماذج وتعليمات مختلفة (راجع قسم Sub-agents في [Context Engineering for Codex CLI](htt
```

**File**: `docs/ar/harness-designs/deepseek/index.md` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+# تحليل تصميم DeepSeek Harness
+
+أُطلق [DeepSeek Harness](https://deepseek.com/harness) (اسم الأمر `dsh`، والمستودع `deepseek-ai/deepseek-harness`) في أغسطس 2026 بصفته إصدار Developer Preview، وقد قدّم له التعريف الرسمي المباشر الآتي: **Agent = Model + Environment + Tools + State**—أي النموذج، والبيئة، والأدوات، والحالة.
+
+إذا كانت تحليلات المنتجات الثلاثة الأولى تسأل «كيف ينبغي تصميم harness؟»، فإن DeepSeek Harness يطرح سؤالًا أكثر جرأة: **هل يمكن أن ينفصل harness عن نموذج بعينه ويصبح بيئة تشغيل مستقلة؟** إجابته نعم، وقد دفع الفكرة إلى أقصاها—إذ تقول [وثيقة البنية](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) حرفيًا: *كل جزء من المنتج هو إضافة برمجية، بما في ذلك موائم النموذج، وسجل الأدوات، وسجل الجلسة، وحتى حلقة الـ agent نفسها*.
+
+نحلله في هذه المقالة مع التركيز على ثلاثة أمور: النواة القائمة على الإضافات، وفاصل القدرات (capability seam)، ومسار الأحداث، فضلًا عن أقوى قيد هندسي فيه: «كل ما يراه النموذج يجب تسجيله».
+
+## التعريف في جملة واحدة
+
+يتكون الـ coding agent التقليدي من «LLM + حلقة agent ثابتة + مجموعة أدوات ثابتة». أما DeepSeek Harness فيتكون من «نموذج + نواة إضافات (Cordis)»؛ ولا تتولى النواة سوى تحميل الإضافات وإزالتها وإدارة تبعياتها وآلية أحداثها، و**لا تمتلك أي قدرة خاصة بالـ agent**—وتقول [وثيقة البنية](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) حرفيًا: «لا توجد نواة ذات امتيازات تحتاج إلى ترقيع»، و«يمكنك توسيع dsh بتركيب إضافة إلى جوار الإضافات الأخرى» بدل تعديل النواة. وهذا يعني أن حلقة الـ agent نفسها ليست مقدسة ولا عصية على التغيير—يمكنك استخدام نموذج DeepSeek، وربط الوكلاء الفرعيين في Claude Code، وإضافة صندوق رمل بعيد، وكتابة ذاكرة مخصصة، واستبدال الحلقة وواجهة المستخدم، ثم تجميع ذلك كله في agent جديد تمامًا.
+
+هذا هو التطبيق الأكثر شمولًا لعبارة الدورة «كل ما يقع خارج أوزان النموذج هو harness»: ما دام harness مستقلًا، فلنجعله نظام تشغيل مستقلًا.
+
+## جوهر البنية 1: فاصل القدرات (Capability Seam)
+
+يستخدم DeepSeek Harness مفهوم Service للتعبير عن «القدرة»، ويقسّم كل قدرة تقريبًا إلى ثلاث طبقات:
+
+```
+Service Definition（能力定义）
+        ↓
+Service Provider（能力提供者）
+        ↓
+Consumer（能力消费者）
+```
+
+لنأخذ نظام الملفات مثالًا: يندرج تحت `FS Service` عدد من Provider مثل Local FS وE2B FS وRemote FS، وتُعرَض جميعها للأعلى بصورة موحّدة على هيئة file tools. وتتبع Shell وSubprocess وSandbox وWeb وLLM وSubAgent البنية نفسها. وهذه البنية الثلاثية ليست خلاصة من عندنا—بل تذكر [وثيقة البنية · Capability seams](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) حرفيًا: *فاصل القدرة هو قدرة قابلة للاستبدال ذات ثلاثة أدوار: Service Definition يعلن الواجهة، وService Provider ينفذها، وConsumer يستخدمها، وغالبًا ما يكون الأخير أداة ظاهرة للنموذج*.
+
+يحل ذلك مشكلة مزمنة في هندسة harness: **هل ينبغي أن يعتمد الـ agent على «أداة محددة»، أم على «واجهة قدرة»؟** يختار DeepSeek Harness الثانية. وبمصطلحات الدورة، يعني هذا توحيد «النظام الفرعي للأدوات» في واجهة: عند استبدال Provider لا يتغير شكل الأدوات المعروضة للنموذج، مع أن البيئة تتغير بالكامل.
+
+## جوهر البنية 2: مسار الأحداث (Event Pipeline)
+
+لا يعمل DeepSeek Harness داخليًا وفق دورة بسيطة من «LLM ← أداة ← LLM»، بل وفق مسار أحداث تكون كل مرحلة فيه نقطة حدث يمكن لإضافة برمجية الاستماع إليها:
+
+```
+turn/start → claim input → assemble（system prompt / context / tools）
+  → agent/pre-step → step/start → LLM request（agent/request）→ llm/stream
+  → assistant/message → tool/call
+  → tools/pre-execute（permission / guard / policy / hook）
+  → tools/execute → tools/post-execute → tool/result → step/end → 下一轮
+```
+
+(المسار أعلاه إعادة صياغة لقسم [وثيقة البنية · Turn flow](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md): تمثل `turn/*` و`step/*` و`user/message` و`assistant/*` و`tool/*` أحداث جلسة دائمة، بينما تمثل `agent/pre-step` و`agent/request` و`llm/stream` و`tools/*` نقاط توسعة يمكن للإضافات الاستماع إليها.)
+
+أكبر مزايا هذا التصميم هي أن **عددًا كبيرًا من الوظائف لا يتطلب تعديل حلقة الـ agent أصلًا**. هل تريد فحصًا أمنيًا قبل تنفيذ الأداة؟ استمع إلى `tools/pre-execute`. هل تريد إضافة ذاكرة؟ احقنها عند `agent/pre-step`. هل تريد تسجيل السلوك؟ اشترك في أحداث الجلسة. هل تريد تعديل طلب النموذج؟ اربطه بـ `agent/request`. هل تريد تقرير مواصلة الاستدلال؟ استمع إلى `agent/turn-stopping`.
+
+مقارنة بالمحاضرة الحادية عشرة، «جعل عملية تشغيل الـ agent قابلة للرصد»، يذهب DeepSeek Harness أبعد: فهو لا «يضيف السجلات» فحسب، بل يحوّل **كل خطوة في الحلقة إلى نقطة حدث**، فتُعلّق قابلية الرصد والأذونات والذاكرة والسياسات كلها على الحلقة بصفتها مستمِعات، بدل أن تُرسّخ داخلها.
+
+## جوهر البنية 3: Session Event Log وقاعدة «كل ما يراه النموذج يجب تسجيله»
+
+يتضمن DeepSeek Harness‏ **Session Event Log للإلحاق فقط**، ويفرض قيدًا هندسيًا شديد القوة. تقول [وثيقة البنية · Session log](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) حرفيًا:
+
+> **كل ما يراه النموذج يجب تسجيله.** يجب أن يكون كل ما يصل إلى طلب النموذج قابلًا لإعادة البناء من السجل، ويؤكد ثابت وقت التشغيل ذلك.
+
+(أي إن كل
```

**File**: `docs/ar/harness-designs/index.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+# تحليل تصميمات Harness المتقدمة
+
+يقارن هذا القسم نظريات harness الواردة في محاضرات الدورة، منتجًا تلو الآخر، بأحدث المنتجات الواقعية المتقدمة. وفي كل منتج نهتم بسؤال واحد فقط: **كيف صُمِّم harness الخاص به؟** أي طبقة البنية التحتية الهندسية المحيطة بالنموذج: الأنظمة الفرعية الخمسة، وهي التعليمات والأدوات والبيئة والحالة والتغذية الراجعة، إلى جانب الآليات الجوهرية مثل استمرارية السياق، والتهيئة، والتحقق، وقابلية الرصد، والتسليم، والحلقات التكرارية.
+
+نتعمّد ألّا نناقش قوة قدرات النموذج الاستدلالية، أو ارتفاع نتيجته في اختبار معيّن، كما لا نقدّم عرضًا عامًا لما يستطيع هذا الـ agent فعله. فهذه مسائل تخص طبقتي النموذج والمنتج. ما نحلله هنا هو harness وحده—أي كل ما يقع خارج أوزان النموذج.
+
+## لماذا يستحق التحليل
+
+ورد في المحاضرة الأولى أن قوة النموذج لا تعني موثوقية التنفيذ. فقد يختلف أداء النموذج نفسه بمقدار رتبة كاملة عند وضعه في harness مختلف. لكن المحاضرات تشرح «ما ينبغي فعله»، بينما تجيب هذه المنتجات عن سؤال «ما الذي تفعله الفرق الرائدة فعليًا».
+
+كل منتج هو مجموعة مستقلة من قرارات التصميم. وعند مقارنتها معًا، سترى كيف تطبّق فرق مختلفة الآليات الجوهرية نفسها بطرائق متباينة تمامًا:
+
+- يحوّل **Pi**‏ harness إلى نواة شديدة البساطة مع امتدادات قابلة للبرمجة، ويعتمد على «حد أدنى من موجّه النظام + التحميل عند الطلب» لهندسة السياق.
+- يحوّل **Claude Code**‏ harness إلى runtime متكامل: ذاكرة طبقية، وcompaction بخمس طبقات، وpermissions، وhooks، وsubagents.
+- يدفع **Codex** فلسفة harness إلى أقصاها: المستودع هو مصدر الحقيقة، وAGENTS.md ليس سوى صفحة فهرس، مع استخدام worktree لعزل البيئة.
+- يعرّف **DeepSeek Harness**‏ harness نفسه بوصفه runtime مستقلًا عن النموذج: Everything is a Plugin.
+
+## قائمة المقالات
+
+- [تحليل تصميم harness في Pi](./pi/): نواة شديدة البساطة + امتدادات قابلة للبرمجة، تدمج هندسة السياق خارج موجّه النظام.
+- [تحليل تصميم harness في Claude Code](./claude-code/): ذاكرة طبقية، وcompaction بخمس طبقات، وpermissions وhooks، ضمن runtime متكامل للـ agent.
+- [تحليل تصميم harness في Codex](./codex/): المستودع هو مصدر الحقيقة، وAGENTS.md صفحة فهرس، مع عزل البيئة وحلقات التغذية الراجعة.
+- [تحليل تصميم DeepSeek Harness](./deepseek/): كل شيء إضافة برمجية، حتى حلقة الـ agent نفسها قابلة للاستبدال.
+
+## كيفية القراءة
+
+نوصي بقراءة المحاضرات الأولى من المادة، ولا سيما [المحاضرة الثانية: ما هو Harness بالضبط؟](../lectures/lecture-02-what-a-harness-actually-is/)، لبناء إطار الأنظمة الفرعية الخمسة، ثم العودة إلى هنا لمعرفة كيف تطبّق المنتجات الواقعية هذه الآليات.
+
+تتضمن نهاية كل مقالة قسمين هما «المواءمة مع إطار الدورة» و«تصميمات جديرة بالاقتباس»، لمساعدتك على إعادة ترجمة تصميم المنتج سريعًا إلى مفاهيم الدورة وتطبيقها مباشرة في مشروعك.
```

**File**: `docs/ar/harness-designs/pi/index.md` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+# تحليل تصميم harness في Pi
+
+يصف [Pi](https://pi.dev/) (حزمة npm‏ `@earendil-works/pi-coding-agent`) نفسه بأنه «minimal agent harness»—أي agent harness بالغ البساطة. وهذه عبارة تستحق التفكيك: فهو لا يصف نفسه بأنه «أقوى coding agent»، ولا «أفضل أداة برمجة بالذكاء الاصطناعي»، بل يرسخ موقعه في كلمة **harness** تحديدًا.
+
+نحلل في هذه المقالة Pi باستخدام إطار الأنظمة الفرعية الخمسة في الدورة (التعليمات، والأدوات، والبيئة، والحالة، والتغذية الراجعة)، لنرى كيف تختلف فلسفة تصميمه جذريًا عن Claude Code وCodex. وإليك الجواب مقدمًا: **فلسفة Pi هي «تقليص النواة إلى الحد الأدنى + جعل التوسعة قابلة للبرمجة»؛ فهي تدمج هندسة السياق خارج موجّه النظام، وتترك للمستخدم (بل ولـ Pi نفسه) تعديل harness، بدل أن يقرر Pi‏ harness بالنيابة عنك.**
+
+## التعريف في جملة واحدة
+
+Pi نواة شديدة البساطة: يتعمد تعريفه الرسمي تصغير النواة وإعادة سلطة القرار إليك—وتقول [الصفحة الرئيسية لـ pi.dev](https://pi.dev/) حرفيًا: «اطلب من Pi بناء ما تريده، أو ثبّت حزمة تنفذه بطريقتك». ويقسّم harness إلى أربع طبقات قابلة للتخصيص:
+
+- **Extensions**: hooks بلغة TypeScript مرتبطة بأحداث دورة حياة Pi، وهي واجهة برمجية على مستوى runtime.
+- **Skills**: حزم قدرات تُحمّل عند الطلب، وتتضمن تعليمات وأدوات، وفق progressive disclosure.
+- **قوالب الموجّهات (Prompt templates)**: موجّهات Markdown قابلة لإعادة الاستخدام، تتوسع عند إدخال `/name`.
+- **السِّمات (Themes)**: مظهر TUI.
+
+إن فكرة التقسيم الطبقي هذه في ذاتها تصميم لـ harness: **يُترك تحديد «ما الذي يراه النموذج، ومتى يراه» بالكامل للقواعد والامتدادات، بدل ترسيخه داخل النواة.**
+
+## الحلقة الجوهرية
+
+Pi، مثل سائر coding agent، هو في جوهره حلقة while من «استدلال ← تنفيذ أداة ← ملاحظة ← استدلال مجدد». وما يستحق الاهتمام ليس الحلقة نفسها، بل كيفية تعامل Pi مع غلافها الخارجي: إذ وسّع إدارة السياق من «compaction» داخل الحلقة إلى «التحكم» خارجها.
+
+يعرّض runtime الخاص بـ Pi واجهة برمجية—فإلى جانب TUI التفاعلية، تدعم فقرة [Programmatic Usage في README للشيفرة المصدرية](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md) أوضاع الطباعة/JSON القابلة للبرمجة، وبروتوكول RPC، والتضمين عبر SDK. ويعني ذلك أن الإنسان يستطيع قيادة harness نفسه خطوة بخطوة، كما يستطيع CI/CD أو برنامج آخر قيادته آليًا. وهذا هو الشرط السابق لعبارة «من القيادة اليدوية إلى الحلقة التلقائية» في المحاضرة الثالثة عشرة: إذا لم يكن بالإمكان تشغيل harness إلا بالتفاعل البشري، فلن يدخل حلقة تلقائية أبدًا.
+
+## النظام الفرعي للتعليمات: AGENTS.md وSYSTEM.md
+
+يتعامل Pi مع «التعليمات» بانضباط، لكن بتدرج واضح:
+
+- **AGENTS.md**: يحدد قسم [Project Context Files في README للشيفرة المصدرية](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md) ترتيب التحميل بوضوح—الملف العام `~/.pi/agent/AGENTS.md` ← اجتياز الأدلة الأب صعودًا، مستوى بعد مستوى ← دليل العمل الحالي `./AGENTS.md` (مع توافق أيضًا مع CLAUDE.md). وهذا تطبيق لمبدأ «المستودع هو مصدر الحقيقة»—فالتعليمات ملفات، لا تذكيرات في مربع محادثة.
+- **SYSTEM.md**: تقول [وثائق pi.dev الرسمية](https://pi.dev/docs/usage/project-context) إنه يمكن، على مستوى المشروع، استبدال (replace) موجّه النظام الافتراضي أو الإضافة إليه (append). وهذه هي القناة الرسمية الوحيدة التي يتيحها Pi لتعديل «موجّه النظام»، كما أنها طبقة «الوصف الذاتي للبيئة» فيه.
+
+تؤكد Pi رسميًا أن موجّه النظام نفسه **شديد البساطة**. ويكمن وراء ذلك اختيار واضح: لا تحشو النواة بقواعد مطولة من قبيل «إذا... فعندئذ...»، بل تترك نقاط توسعة لا تظهر فيها القواعد، على هيئة مهارات وامتدادات، إلا عند الحاجة. وهذا ينسجم مباشرة مع المحاضرة الرابعة، «لماذا يفشل ملف التعليمات العملاق الواحد؟»—إذ يتجنب Pi المشكلة بطبيعته عبر «نواة شديدة البساطة + تقسيم الملفات + التحميل عند الطلب».
+
+## الحالة والسياق: أكثر ما يفصله Pi دقة
+
+تستحق هندسة السياق في Pi تحليلًا خاصًا، لأنها تحول مفاهيم الدورة مثل «استمرارية السياق» و«منع فساد السياق» إلى آليات ملموسة:
+
+**1. جعل Compaction قابلًا للبرمجة.** عندما يقترب السياق من حده الأقصى، تُلخص الرسائل القديمة تلقائيًا—وتوضح [وثائق pi.dev الرسمية](https://pi.dev/docs/usage/sessions) أن استراتيجية compaction نفسها **قابلة للتخصيص**: يمكنك استخدام extension لتنفيذ compaction بحسب الموضوع، أو تلخيص واعٍ بالشيفرة، أو حتى استخدام نموذج مختلف للتلخيص. ويعرض README للشيفرة المصدرية تفاصيل الآلية الافتراضية أيضًا: ينطلق compaction التلقائي في حالتين (التعافي من تجاوز السياق / تجاوز عتبة الاحتفاظ)، وتبقي نقطة القطع أحدث 20 ألف token تقريبًا، بينما تُلخّص الرسائل الأسبق في «context handoff» وتخضع لـ compaction تسلسلي على مراحل. أي إن Pi لا يعامل «كيفية compaction» كثابت غير قابل للتغيير، بل كجزء من harness.
+
+**2. السياق الديناميكي (Dynamic context).** تقول [وثائق pi.dev الرسمية](https://pi.dev/docs/usage/extensions) إن extensions تستطيع حقن الرسائل قبل كل جولة استدلال، وترشيح سجل الرسائل، وتنفيذ RAG، وبناء ذاكرة طويلة الأجل. وهذا يتجاوز «compaction بعد امتلاء السياق»: فهو يتيح لك أن تقرر ما يدخل النافذة وما لا يدخلها قبل وصول السياق إليها. ويقابل ذلك في الدورة «جعل عملية تشغيل الـ agent قابلة للرصد والتصحيح» و«الحفاظ على استمرارية السياق»؛ وقد نقل Pi كليهما إلى واجهة extensions.
+
+**3. شجرة session (Session tree).** تذكر [الصفحة الرئيسية لـ pi.dev](https://pi.d
```

---

### Incident Patch 11: `a3042405` (2026-08-06)
**Commit Message**: Merge pull request #61 from alecchen/fix/project-01-docs

docs(project-01): fix harness docs and align en/zh-TW pages

**File**: `docs/en/projects/project-01-baseline-vs-minimal-harness/index.md` (modified, +69/-20)
```diff
@@ -9,37 +9,86 @@
 
 Build a minimal Electron knowledge-base app shell — a window with a document list on the left, a Q&A panel on the right, and a local data directory. The task itself is not complex. What's complex is how you get the agent to complete it.
 
-You run it twice. First time: just a prompt, no preparation. Second time: `AGENTS.md`, `init.sh`, `feature_list.json` pre-placed in the repo. Then compare.
+You run it twice. First time: just a prompt, no preparation. Second time: the minimal harness (e.g. `AGENTS.md`, `init.sh`, `feature_list.json`) pre-placed in the repo. Then compare.
 
 This course scenario uses a short rediscovery/preparation interval as an example, not a fixed measured result.
 
+## Use the Checked-In Project
+
+Repository path: [`projects/project-01/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01)
+
+| Directory | What it contains | How to use it |
+|------|------|------|
+| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | The weak-harness run. It has only [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) as the task description and no `AGENTS.md` or `feature_list.json`. Note: `starter/` also contains a reference implementation of the app — remove the app source (`src/`, `package.json`, configs, `scripts/`) before the run so the agent builds it from scratch. The `data/` sample documents are your call: keep them in both runs or remove them from both, so the two runs stay symmetric. | Give the prompt to your coding agent and measure what it completes without extra structure. |
+| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | The same product slice with explicit harness artifacts: [`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENTS.md), [`CLAUDE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/CLAUDE.md), [`init.sh`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/init.sh), [`feature_list.json`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/feature_list.json), [`claude-progress.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/claude-progress.md), and [`docs/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution/docs) ([`ARCHITECTURE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/ARCHITECTURE.md), [`PRODUCT.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/PRODUCT.md)). | Compare how the same task is made concrete through rules and verification evidence. Before the strong run, reset the checked-in evidence: set every `feature_list.json` status to `not-started` and clear its `evidence`/`testedAt` values (keep the fields), and clear the session log in `claude-progress.md` (keep the title), or the agent will see all four features already passing and have nothing to build. |
+
+The four concrete features are window launch, document list, question panel, and local data directory creation. Inspect `solution/feature_list.json` for the expected evidence for each feature.
+
 ## Tools
 
 - Claude Code or Codex (pick one, use it for both runs)
-- Git (manage branches and compare)
+- Two isolated working directories (one per run; never both present while a run is active)
 - Node.js + Electron (project stack)
 - A timer (record each run's duration)
 
 ## Harness Mechanism
 
-Minimal harness: `AGENTS.md` + `init.sh` + `feature_list.json`
+Minimal harness: `AGENTS.md` + `init.sh` + `feature_list.json` + `CLAUDE.md` + `claude-progress.md` + `docs/`
 
-## Use the Checked-In Project
+## Run Protocol
 
-Repository path: [`projects/project-01/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01)
+### Preparation
 
-| Directory | What it contains | How to use it |
-|------|------|------|
-| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | The weak-harness run. It has only [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) as the task description and no `AGENTS.md` or `feature_list.json`. | Give the prompt to your coding agent and measure what it completes without extra structure. |
-| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | The same product slice with explicit harness artifacts: [`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENT
```

**File**: `docs/zh-TW/projects/project-01-baseline-vs-minimal-harness/index.md` (modified, +24/-17)
```diff
@@ -7,7 +7,7 @@
 
 用 Electron 搭一個最簡的知識庫應用殼子——能啟動視窗、左側顯示文件清單、右側顯示問答面板、本地有一個資料目錄。任務本身不複雜，複雜的是你如何讓代理完成它。
 
-你需要執行兩次。第一次只給一段提示詞，什麼都不準備，看代理能做到什麼程度。第二次提前在儲存庫裡放好 `AGENTS.md`、`init.sh`、`feature_list.json`，用結構化的方式告訴代理該做什麼、怎麼驗證、什麼時候算做完。然後對比兩次結果。
+你需要執行兩次。第一次只給一段提示詞，什麼都不準備，看代理能做到什麼程度。第二次提前在儲存庫裡放好最小 harness（例如 `AGENTS.md`、`init.sh`、`feature_list.json`），用結構化的方式告訴代理該做什麼、怎麼驗證、什麼時候算做完。然後對比兩次結果。
 
 課程場景使用一小段準備或重新探索時間作為示例，不依賴固定測量值。
 
@@ -17,57 +17,60 @@
 
 | 目錄 | 內容 | 怎麼用 / 比較什麼 |
 |------|------|------|
-| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | 弱 harness 版本。只有 [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) 作為任務描述，沒有 `AGENTS.md` 或 `feature_list.json`。 | 把提示詞交給程式碼代理，衡量它在沒有額外結構時完成了什麼。 |
-| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | 相同的產品切片，但加入明確的 harness 產物：[`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENTS.md)、[`CLAUDE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/CLAUDE.md)、[`init.sh`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/init.sh)、[`feature_list.json`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/feature_list.json)、[`claude-progress.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/claude-progress.md)。 | 對照規則與驗證證據如何把同一任務變得可執行、可驗收。 |
+| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | 弱 harness 版本。只有 [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) 作為任務描述，沒有 `AGENTS.md` 或 `feature_list.json`。注意：`starter/` 同時含有應用程式的參考實作——執行前請刪除應用程式原始碼（`src/`、`package.json`、設定檔、`scripts/`），讓代理從零開始建置。`data/` 的範例文件由你決定：兩輪都保留，或兩輪都刪除，讓兩次執行保持對稱。 | 把提示詞交給程式碼代理，衡量它在沒有額外結構時完成了什麼。 |
+| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | 相同的產品切片，但加入明確的 harness 產物：[`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENTS.md)、[`CLAUDE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/CLAUDE.md)、[`init.sh`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/init.sh)、[`feature_list.json`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/feature_list.json)、[`claude-progress.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/claude-progress.md)、以及 [`docs/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution/docs)（[`ARCHITECTURE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/ARCHITECTURE.md)、[`PRODUCT.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/PRODUCT.md)）。 | 對照規則與驗證證據如何把同一任務變得可執行、可驗收。執行強 harness 之前，先重置內建的證據：將 `feature_list.json` 每個功能狀態改為 `not-started` 並清空其 `evidence`、`testedAt` 值（保留欄位），且清除 `claude-progress.md` 中的執行記錄（保留標題）——否則代理會看到所有功能已完成而無事可做。 |
 
 四個具體功能是視窗啟動、文件清單、問答面板、本地資料目錄建立。每個功能的預期證據請看 `solution/feature_list.json`。
 
 ## 用什麼工具
 
 - Claude Code 或 Codex（選一個，兩次都用同一個）
-- Git（管理分支和對比）
+- 兩個互相隔離的執行目錄（每輪一個；執行期間不要讓兩份同時存在）
 - Node.js + Electron（專案技術堆疊）
 - 一個計時器（記錄每次執行時期間）
 
 ## Harness 機制
 
-最小 harness：`AGENTS.md` + `init.sh` + `feature_list.json`
+最小 harness：`AGENTS.md` + `init.sh` + `feature_list.json` + `CLAUDE.md` + `claude-progress.md` + `docs/`
 
 ## 具體步驟
 
 ### 準備工作
 
-1. 從一個乾淨的 commit 出發，記錄 commit hash。
-2. 建立兩個分支：`p01-baseline` 和 `p01-improved`。
-3. 準備一段相同的任務提示詞，內容為「用 Electron 做一個知識庫應用，視窗左側是文件清單區域，右側是問答面板區域，應用需要建立並使用本地資料目錄。」
+1. 準備兩個互相隔離的執行目錄，例如 `p01-baseline/` 和 `p01-improved/`。一次只進行一輪：放好素材、執行、封存結果、刪除目錄後，再開始下一輪。
+2. 不要用 git 分支來區分兩輪。程式碼代理有完整的檔案系統存取權，會探索兄弟目錄和分支引用；弱 harness 那一輪若能看到強 harness 的素材（`feature_list.json`、`claude-progress.md`、`docs/`），實驗就被污染了。
+3. 準備一段相同的任務提示詞，內容為 `starter/task-prompt.md` 的原文：「Build an Electron app that can show documents and answer questions。」
 
 ### 第一次執行（弱 harness）
 
-切到 `p01-baseline` 分支。
+在 `p01-baseline/` 目錄中只放任務提示詞（不放任何 harness 檔案）。
 
 1. 只用上述提示詞啟動代理。
 2. 不提供 `AGENTS.md`，不提供啟動腳本，不提供驗收標準。
-3. 設定相同的時間上限和輪次上限（建議 30 分鐘 / 20 輪）。
-4. 代理停止後，執行 `npm start`（或對應啟動命令），確認應用是否能正常啟動。
-5. 記錄：終端輸出、關鍵 diff、代理的最終總結。
-6. **不要手動修改程式碼**。無法啟動就如實記錄。
+3. 代理停止後，執行 `npm start`（或對應啟動命令），確認應用是否能正常啟動。
+4. 記錄：終端輸出、關鍵 diff、代理的最終總結。
+5. **不要手動修改程式碼**。無法啟動就如實記錄。
+6. 封存執行結果，刪除 `p01-baseline/`，再進行第二次執行。
 
 ### 第二次執行（強 harness）
 
-切換至 `p01-improved` 分支。在啟動代理之前，先在儲存庫裡準備好：
+在 `p01-improved/` 目錄中，在啟動代理之前先準備好：
 
 - `AGENTS.md`：說明專案結構、啟動命令、Electron 層邊界規則
-
```

**File**: `projects/project-01/solution/CLAUDE.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # CLAUDE.md -- Quick Reference for Claude Code
 
+@AGENTS.md
+
 ## Project Overview
 
 This is an Electron + TypeScript + React knowledge base application. The codebase is structured into four layers: main process, preload, renderer, and services.
```

---

### Incident Patch 12: `95a50dbd` (2026-08-05)
**Commit Message**: docs(project-01): fix harness docs and align en/zh-TW pages

The docs contradicted the checked-in project-01 code: the harness artifact
list, the strip-the-app note, and the evidence-reset steps. The English page
also lacked the run protocol, metrics, deliverables, and framing that zh-TW
carried, and the zh-TW page imposed a 30-min/20-round limit and a git-branch
workflow that lets a coding agent contaminate the weak-harness run.

- en + zh-TW: mark the intro artifact list as a subset, add the docs/ links,
  the strip-the-app note, the data-dir symmetry rule, and reset-evidence
  guidance; align both pages to the same section flow (run protocol, how to
  measure, what to submit, framing, related lectures).
- zh-TW: drop the 30-min/20-round limit and the git-branch workflow in favor
  of isolated run directories; quote the real starter/task-prompt.md; fix the
  init.sh description.
- solution/CLAUDE.md: import @AGENTS.md so Claude Code loads the full harness
  spec (CLAUDE.md is auto-loaded, AGENTS.md is not).

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `docs/en/projects/project-01-baseline-vs-minimal-harness/index.md` (modified, +69/-20)
```diff
@@ -9,37 +9,86 @@
 
 Build a minimal Electron knowledge-base app shell — a window with a document list on the left, a Q&A panel on the right, and a local data directory. The task itself is not complex. What's complex is how you get the agent to complete it.
 
-You run it twice. First time: just a prompt, no preparation. Second time: `AGENTS.md`, `init.sh`, `feature_list.json` pre-placed in the repo. Then compare.
+You run it twice. First time: just a prompt, no preparation. Second time: the minimal harness (e.g. `AGENTS.md`, `init.sh`, `feature_list.json`) pre-placed in the repo. Then compare.
 
 This course scenario uses a short rediscovery/preparation interval as an example, not a fixed measured result.
 
+## Use the Checked-In Project
+
+Repository path: [`projects/project-01/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01)
+
+| Directory | What it contains | How to use it |
+|------|------|------|
+| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | The weak-harness run. It has only [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) as the task description and no `AGENTS.md` or `feature_list.json`. Note: `starter/` also contains a reference implementation of the app — remove the app source (`src/`, `package.json`, configs, `scripts/`) before the run so the agent builds it from scratch. The `data/` sample documents are your call: keep them in both runs or remove them from both, so the two runs stay symmetric. | Give the prompt to your coding agent and measure what it completes without extra structure. |
+| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | The same product slice with explicit harness artifacts: [`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENTS.md), [`CLAUDE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/CLAUDE.md), [`init.sh`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/init.sh), [`feature_list.json`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/feature_list.json), [`claude-progress.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/claude-progress.md), and [`docs/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution/docs) ([`ARCHITECTURE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/ARCHITECTURE.md), [`PRODUCT.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/PRODUCT.md)). | Compare how the same task is made concrete through rules and verification evidence. Before the strong run, reset the checked-in evidence: set every `feature_list.json` status to `not-started` and clear its `evidence`/`testedAt` values (keep the fields), and clear the session log in `claude-progress.md` (keep the title), or the agent will see all four features already passing and have nothing to build. |
+
+The four concrete features are window launch, document list, question panel, and local data directory creation. Inspect `solution/feature_list.json` for the expected evidence for each feature.
+
 ## Tools
 
 - Claude Code or Codex (pick one, use it for both runs)
-- Git (manage branches and compare)
+- Two isolated working directories (one per run; never both present while a run is active)
 - Node.js + Electron (project stack)
 - A timer (record each run's duration)
 
 ## Harness Mechanism
 
-Minimal harness: `AGENTS.md` + `init.sh` + `feature_list.json`
+Minimal harness: `AGENTS.md` + `init.sh` + `feature_list.json` + `CLAUDE.md` + `claude-progress.md` + `docs/`
 
-## Use the Checked-In Project
+## Run Protocol
 
-Repository path: [`projects/project-01/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01)
+### Preparation
 
-| Directory | What it contains | How to use it |
-|------|------|------|
-| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | The weak-harness run. It has only [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) as the task description and no `AGENTS.md` or `feature_list.json`. | Give the prompt to your coding agent and measure what it completes without extra structure. |
-| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | The same product slice with explicit harness artifacts: [`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENT
```

**File**: `docs/zh-TW/projects/project-01-baseline-vs-minimal-harness/index.md` (modified, +24/-17)
```diff
@@ -7,7 +7,7 @@
 
 用 Electron 搭一個最簡的知識庫應用殼子——能啟動視窗、左側顯示文件清單、右側顯示問答面板、本地有一個資料目錄。任務本身不複雜，複雜的是你如何讓代理完成它。
 
-你需要執行兩次。第一次只給一段提示詞，什麼都不準備，看代理能做到什麼程度。第二次提前在儲存庫裡放好 `AGENTS.md`、`init.sh`、`feature_list.json`，用結構化的方式告訴代理該做什麼、怎麼驗證、什麼時候算做完。然後對比兩次結果。
+你需要執行兩次。第一次只給一段提示詞，什麼都不準備，看代理能做到什麼程度。第二次提前在儲存庫裡放好最小 harness（例如 `AGENTS.md`、`init.sh`、`feature_list.json`），用結構化的方式告訴代理該做什麼、怎麼驗證、什麼時候算做完。然後對比兩次結果。
 
 課程場景使用一小段準備或重新探索時間作為示例，不依賴固定測量值。
 
@@ -17,57 +17,60 @@
 
 | 目錄 | 內容 | 怎麼用 / 比較什麼 |
 |------|------|------|
-| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | 弱 harness 版本。只有 [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) 作為任務描述，沒有 `AGENTS.md` 或 `feature_list.json`。 | 把提示詞交給程式碼代理，衡量它在沒有額外結構時完成了什麼。 |
-| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | 相同的產品切片，但加入明確的 harness 產物：[`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENTS.md)、[`CLAUDE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/CLAUDE.md)、[`init.sh`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/init.sh)、[`feature_list.json`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/feature_list.json)、[`claude-progress.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/claude-progress.md)。 | 對照規則與驗證證據如何把同一任務變得可執行、可驗收。 |
+| [`starter/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/starter) | 弱 harness 版本。只有 [`task-prompt.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/starter/task-prompt.md) 作為任務描述，沒有 `AGENTS.md` 或 `feature_list.json`。注意：`starter/` 同時含有應用程式的參考實作——執行前請刪除應用程式原始碼（`src/`、`package.json`、設定檔、`scripts/`），讓代理從零開始建置。`data/` 的範例文件由你決定：兩輪都保留，或兩輪都刪除，讓兩次執行保持對稱。 | 把提示詞交給程式碼代理，衡量它在沒有額外結構時完成了什麼。 |
+| [`solution/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution) | 相同的產品切片，但加入明確的 harness 產物：[`AGENTS.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/AGENTS.md)、[`CLAUDE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/CLAUDE.md)、[`init.sh`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/init.sh)、[`feature_list.json`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/feature_list.json)、[`claude-progress.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/claude-progress.md)、以及 [`docs/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/projects/project-01/solution/docs)（[`ARCHITECTURE.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/ARCHITECTURE.md)、[`PRODUCT.md`](https://github.com/walkinglabs/learn-harness-engineering/blob/main/projects/project-01/solution/docs/PRODUCT.md)）。 | 對照規則與驗證證據如何把同一任務變得可執行、可驗收。執行強 harness 之前，先重置內建的證據：將 `feature_list.json` 每個功能狀態改為 `not-started` 並清空其 `evidence`、`testedAt` 值（保留欄位），且清除 `claude-progress.md` 中的執行記錄（保留標題）——否則代理會看到所有功能已完成而無事可做。 |
 
 四個具體功能是視窗啟動、文件清單、問答面板、本地資料目錄建立。每個功能的預期證據請看 `solution/feature_list.json`。
 
 ## 用什麼工具
 
 - Claude Code 或 Codex（選一個，兩次都用同一個）
-- Git（管理分支和對比）
+- 兩個互相隔離的執行目錄（每輪一個；執行期間不要讓兩份同時存在）
 - Node.js + Electron（專案技術堆疊）
 - 一個計時器（記錄每次執行時期間）
 
 ## Harness 機制
 
-最小 harness：`AGENTS.md` + `init.sh` + `feature_list.json`
+最小 harness：`AGENTS.md` + `init.sh` + `feature_list.json` + `CLAUDE.md` + `claude-progress.md` + `docs/`
 
 ## 具體步驟
 
 ### 準備工作
 
-1. 從一個乾淨的 commit 出發，記錄 commit hash。
-2. 建立兩個分支：`p01-baseline` 和 `p01-improved`。
-3. 準備一段相同的任務提示詞，內容為「用 Electron 做一個知識庫應用，視窗左側是文件清單區域，右側是問答面板區域，應用需要建立並使用本地資料目錄。」
+1. 準備兩個互相隔離的執行目錄，例如 `p01-baseline/` 和 `p01-improved/`。一次只進行一輪：放好素材、執行、封存結果、刪除目錄後，再開始下一輪。
+2. 不要用 git 分支來區分兩輪。程式碼代理有完整的檔案系統存取權，會探索兄弟目錄和分支引用；弱 harness 那一輪若能看到強 harness 的素材（`feature_list.json`、`claude-progress.md`、`docs/`），實驗就被污染了。
+3. 準備一段相同的任務提示詞，內容為 `starter/task-prompt.md` 的原文：「Build an Electron app that can show documents and answer questions。」
 
 ### 第一次執行（弱 harness）
 
-切到 `p01-baseline` 分支。
+在 `p01-baseline/` 目錄中只放任務提示詞（不放任何 harness 檔案）。
 
 1. 只用上述提示詞啟動代理。
 2. 不提供 `AGENTS.md`，不提供啟動腳本，不提供驗收標準。
-3. 設定相同的時間上限和輪次上限（建議 30 分鐘 / 20 輪）。
-4. 代理停止後，執行 `npm start`（或對應啟動命令），確認應用是否能正常啟動。
-5. 記錄：終端輸出、關鍵 diff、代理的最終總結。
-6. **不要手動修改程式碼**。無法啟動就如實記錄。
+3. 代理停止後，執行 `npm start`（或對應啟動命令），確認應用是否能正常啟動。
+4. 記錄：終端輸出、關鍵 diff、代理的最終總結。
+5. **不要手動修改程式碼**。無法啟動就如實記錄。
+6. 封存執行結果，刪除 `p01-baseline/`，再進行第二次執行。
 
 ### 第二次執行（強 harness）
 
-切換至 `p01-improved` 分支。在啟動代理之前，先在儲存庫裡準備好：
+在 `p01-improved/` 目錄中，在啟動代理之前先準備好：
 
 - `AGENTS.md`：說明專案結構、啟動命令、Electron 層邊界規則
-
```

**File**: `projects/project-01/solution/CLAUDE.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # CLAUDE.md -- Quick Reference for Claude Code
 
+@AGENTS.md
+
 ## Project Overview
 
 This is an Electron + TypeScript + React knowledge base application. The codebase is structured into four layers: main process, preload, renderer, and services.
```

---

### Incident Patch 13: `391ed7c6` (2026-08-04)
**Commit Message**: fix: clarify session progress and project solution setup

**File**: `README.md` (modified, +7/-1)
```diff
@@ -252,12 +252,18 @@ The idea is simple: instead of just writing prompts, give your agent a set of st
     ├── CLAUDE.md              <-- (alternative, if using Claude Code)
     ├── init.sh                <-- runs install + verify + start
     ├── feature_list.json      <-- what features exist, which are done
-    ├── claude-progress.md     <-- what happened each session
+    ├── claude-progress.md     <-- session progress (historical filename; agent-agnostic)
     └── src/                   <-- your actual code
 ```
 
 Grab the starter templates from the [Resource Library](https://walkinglabs.github.io/learn-harness-engineering/en/resources/) and drop them into your project. That's it. Four files, and your agent sessions will already be significantly more stable than running on prompts alone.
 
+`claude-progress.md` is a generic, repository-local session progress log; the
+name is retained for compatibility with the course examples. It is not tied to
+Claude Code and is not updated automatically by any agent. Codex, OpenHands,
+Antigravity, and other coding agents can use the same file when their root
+instructions tell them to read it at startup and update it before handoff.
+
 ---
 
 ## Capstone Project: A Real App
```

**File**: `docs/en/lectures/lecture-01-why-capable-agents-still-fail/index.md` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ With the scenarios above in mind, these concepts are no longer just jargon:
 
 There is really only one core principle: **When things fail, don't swap the model first — check the harness.** If the same model succeeds on similar, well-structured tasks, assume it's a harness problem.
 
-What does this look like in practice? Attribute every failure to a specific layer. Don't just say "the model isn't good enough." Ask yourself: was the task unclear? Was context insufficient? Were there no verification methods? Map each failure to one of the five defense layers — task specification, context provision, execution environment, verification feedback, state management. Build this habit, and you'll find "the model isn't good enough" appearing less and less in your logs.
+What does this look like in practice? Attribute every failure to a specific layer. Don't just say "the model isn't good enough." Ask yourself: was the task unclear? Was context insufficient? Were there no verification methods? Map each failure to one of the five defense layers — task specification, context provision, execution environment, verification feedback, or state management. These are failure-diagnosis layers, not additional core concepts. Build this habit, and you'll find "the model isn't good enough" appearing less and less in your logs.
 
 Then, write an explicit Definition of Done for every task. Don't say "add a search feature." Spell it out:
 ```
```

**File**: `docs/en/resources/index.md` (modified, +5/-1)
```diff
@@ -23,6 +23,10 @@ For a minimal setup, begin with:
 - root instructions: [`templates/AGENTS.md`](./templates/AGENTS.md) or [`templates/CLAUDE.md`](./templates/CLAUDE.md)
 - feature state: [`templates/feature_list.json`](./templates/feature_list.json)
 - progress log: [`templates/claude-progress.md`](./templates/claude-progress.md)
+
+The filename is a historical course convention. This is a generic,
+repository-local session progress log: any coding agent can use it, but agents
+only read or update it when their instructions explicitly tell them to do so.
 - bootstrap script reference: `docs/en/resources/templates/init.sh`
 
 Then add:
@@ -47,7 +51,7 @@ If you want the fuller OpenAI-style repository structure from the
 
 - `AGENTS.md` or `CLAUDE.md`
 - `feature_list.json`
-- `claude-progress.md`
+- `claude-progress.md` (generic session progress log; historical filename)
 - `init.sh`
 
 Those four files are enough to make most agent workflows noticeably more stable.
```

**File**: `docs/en/resources/templates/claude-progress.md` (modified, +13/-0)
```diff
@@ -1,5 +1,18 @@
 # Progress Log
 
+<!--
+This filename is kept for compatibility with the course examples. The file is
+agent-agnostic: Codex, Claude Code, OpenHands, and other coding agents can use
+it. Read it at session startup and update it before handoff through the
+repository's agent instructions; no agent updates it automatically.
+-->
+
+This is a generic repository-local session progress log. The
+`claude-progress.md` filename is a historical course convention, not a
+Claude Code requirement. Any coding agent can use it when the repository's
+instructions tell it to read the file at startup and update it before handoff;
+agents do not update it automatically.
+
 ## Current Verified State
 
 - Repository root:
```

**File**: `docs/zh/resources/index.md` (modified, +6/-1)
```diff
@@ -21,6 +21,11 @@
 - 根指令文件：[`templates/AGENTS.md`](./templates/AGENTS.md) 或 [`templates/CLAUDE.md`](./templates/CLAUDE.md)
 - 功能状态文件：[`templates/feature_list.json`](./templates/feature_list.json)
 - 进度日志：[`templates/claude-progress.md`](./templates/claude-progress.md)
+
+这个文件名是课程早期留下的约定，实际是通用的、放在仓库里的会话进度日志，
+并不绑定 Claude Code。Codex、OpenHands、Antigravity 等 agent 都可以使用，
+但必须在 `AGENTS.md` 或其他等价指令里明确要求它在开工时读取、收尾时更新；
+agent 不会自动维护这个文件。
 - 启动脚本参考：`docs/resources/templates/init.sh`
 
 然后按需要补上：
@@ -43,7 +48,7 @@
 
 - `AGENTS.md` 或 `CLAUDE.md`
 - `feature_list.json`
-- `claude-progress.md`
+- `claude-progress.md`（通用会话进度日志，文件名沿用历史约定）
 - `init.sh`
 
 先把这四样放进项目里，再开始让 agent 持续工作，通常就已经能明显降低返工和瞎猜。
```

**File**: `docs/zh/resources/templates/claude-progress.md` (modified, +10/-0)
```diff
@@ -1,5 +1,15 @@
 # 进度日志
 
+<!--
+文件名沿用课程历史约定，仅为兼容已有示例。这个文件与具体 agent 无关，Codex、
+Claude Code、OpenHands 等都可以使用。请在仓库指令中要求 agent 开工时读取、
+交接前更新；任何 agent 都不会自动维护它。
+-->
+
+这是一个通用的仓库内会话进度日志。`claude-progress.md` 只是课程沿用的历史
+文件名，并不要求使用 Claude Code。只要仓库里的指令明确要求，Codex 或其他
+coding agent 都可以在开工时读取、交接前更新；agent 不会自动维护这个文件。
+
 ## 当前已验证状态
 
 - 仓库根目录：
```

**File**: `projects/project-01/solution/package.json` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@
   "devDependencies": {
     "@types/react": "^18.3.12",
     "@types/react-dom": "^18.3.1",
+    "@types/node": "^22.20.1",
     "@types/uuid": "^9.0.7",
     "@vitejs/plugin-react": "^4.3.4",
     "electron": "^33.2.0",
```

**File**: `projects/project-01/solution/src/renderer/App.tsx` (modified, +2/-2)
```diff
@@ -1,9 +1,9 @@
-import React, { useState, useCallback } from 'react';
+import { useState, useCallback } from 'react';
 import { DocumentList } from './components/DocumentList';
 import { QuestionPanel } from './components/QuestionPanel';
 import { DocumentDetail } from './components/DocumentDetail';
 import { StatusBar } from './components/StatusBar';
-import { Document, AppStatus, QAResponse } from '../../shared/types';
+import { Document, AppStatus, QAResponse } from '../shared/types';
 
 declare global {
   interface Window {
```

---

### Incident Patch 14: `6cc3e715` (2026-08-04)
**Commit Message**: Merge pull request #60 from mizuno0237/fix/zh-cn-readme-doc-links

fix(zh-CN): point syllabus links to Chinese docs instead of English

**File**: `docs-readme/zh-CN/README.md` (modified, +2/-0)
```diff
@@ -361,6 +361,8 @@ Harness Engineering 是围绕模型构建一个完整的工作环境，使其产
 | [L10](../../docs/zh/lectures/lecture-10-why-end-to-end-testing-changes-results/index.md) | 为什么端到端测试能改变结果？ | 只有完整的流水线运行才算真正的验证 |
 | [L11](../../docs/zh/lectures/lecture-11-why-observability-belongs-inside-the-harness/index.md) | 为什么可观测性应该属于 Harness？ | 如果你看不到代理做了什么，你就无法修复它破坏的东西 |
 | [L12](../../docs/zh/lectures/lecture-12-why-every-session-must-leave-a-clean-state/index.md) | 为什么每次会话都必须留下干净的状态？ | 下一次会话的成功取决于这一次会话的清理 |
+
+### 项目——6 个动手项目，将讲座方法应用到同一个 Electron 应用上
 | [L13](../../docs/zh/lectures/lecture-13-loop-engineering/index.md) | 为什么你需要停止亲自提示你的代理？ | 从手动驱动到自动循环——目标循环、定时循环、制造者-检查者分离 |
 | [L14](../../docs/zh/lectures/lecture-14-graph-engineering/index.md) | 为什么单循环会演变成图？ | 从单循环到图工程——节点、边、共享状态、路由，以及何时真正值得画图 |
 
```

---

### Incident Patch 15: `da150305` (2026-08-04)
**Commit Message**: Merge branch 'main' into fix/zh-cn-readme-doc-links

**File**: `CLAUDE.md` (modified, +3/-3)
```diff
@@ -31,12 +31,12 @@ npm run test:watch       # Vitest watch mode
 
 - `docs/` — VitePress documentation site (lectures, projects, resources)
 - `docs/.vitepress/config.mts` — Nav/sidebar config for all 15 locales (en, zh, zh-TW, ja, ko, es, fr, ru, de, ar, vi, uz, tr, uk, pt-BR)
-- `docs/<lang>/lectures/` — 13 lectures, each with `index.md` + `code/` examples
-- `docs/<lang>/projects/` — 7 project descriptions
+- `docs/<lang>/lectures/` — 14 lectures, each with `index.md` + `code/` examples
+- `docs/<lang>/projects/` — 8 project descriptions
 - `docs/<lang>/resources/` — localized templates, references, OpenAI advanced pack
 - `docs-readme/` — localized README translations (one directory per locale)
 - `projects/shared/` — Shared Electron + TypeScript + React foundation
-- `projects/project-NN/` — Per-project `starter/` and `solution/` directories (project-01 through project-06; project-07 is docs-only so far)
+- `projects/project-NN/` — Per-project `starter/` and `solution/` directories (project-01 through project-06; project-07 and project-08 are docs-only so far)
 
 ## Architecture
 
```

**File**: `README.md` (modified, +40/-10)
```diff
@@ -21,15 +21,28 @@
 <p align="center"><strong>A project-based course on building the environment, state management, verification, and control mechanisms that make AI coding agents work reliably.</strong></p>
 
 <p align="center">
-  <img src="https://img.shields.io/badge/Lectures-13-blue?style=flat-square" alt="13 Lectures">
-  <img src="https://img.shields.io/badge/Projects-7-green?style=flat-square" alt="7 Projects">
+  <img src="https://img.shields.io/badge/Lectures-14-blue?style=flat-square" alt="14 Lectures">
+  <img src="https://img.shields.io/badge/Projects-8-green?style=flat-square" alt="8 Projects">
   <img src="https://img.shields.io/badge/Languages-15-yellow?style=flat-square" alt="15 Languages">
   <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="MIT License">
   <a href="https://discord.gg/XU7DQmpqk"><img src="https://img.shields.io/badge/Discord-Join_Community-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Join the Discord community"></a>
 </p>
 
 > 🌍 This course is available in **15 languages**: English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Русский, Deutsch, العربية, Tiếng Việt, Oʻzbekcha, Türkçe, Portuguese (BR), Українська. Choose your language from the badges above.
 
+## 🆕 What's New — August 2026
+
+**Graph Engineering Update — 1 new lecture, 1 new project**
+
+| What | Details |
+|------|---------|
+| **Lecture 14** | [From Single Loops to Graph Engineering](docs/en/lectures/lecture-14-graph-engineering/index.md) — Why a single loop grows into a graph: the four stacked layers (prompt → context → loop → graph) and where harness sits in that stack, the four parts of a graph (nodes, edges, shared state, routing), why in-loop checkpoints can't fix the three structural failures at scale (Goodhart, blindness upward, conflict), a framework-agnostic six-step walkthrough for building your first graph, graph vs. workflow, anchors, which open-source "graph engineering" projects existed before the name vs. after it, the orchestration tax, and when a graph is actually worth drawing. |
+| **Project 08** | [Draw Your Workflow as a Graph](docs/en/projects/project-08-graph-engineering-first-graph/index.md) — Three progressive experiments: draw your maker-checker loop as an explicit graph, add a parallel fan-out/fan-in node, then add a conditional rollback edge and a human-approval node. |
+
+**Key idea:** A loop is a graph with one node. When your task needs specialization, parallelism, shared state, verification, and recovery — it has stopped being a loop. It's a graph.
+
+---
+
 ## 🆕 What's New — July 2026
 
 **Loop Engineering Update — 1 new lecture, 1 new project**
@@ -229,7 +242,7 @@ The curriculum is divided into three parts:
 
 ## Quick Start: Improve Your Agent Today
 
-You don't need to read all 13 lectures before you start getting value. If you're already using a coding agent on a real project, here's how to improve it right now.
+You don't need to read all 14 lectures before you start getting value. If you're already using a coding agent on a real project, here's how to improve it right now.
 
 The idea is simple: instead of just writing prompts, give your agent a set of structured files that define what to do, what's been done, and how to verify the work. These files live inside your repo, so every session starts from the same state.
 
@@ -340,6 +353,18 @@ The course is designed to be done in order. Each phase builds on the last.
          v
     P07  Build your first automated loop
          (goal loop, timer loop, maker-checker)
+
+    Phase 8: STRUCTURE THE SYSTEM
+    =============================
+
+    L14  Draw the system as a graph —
+         nodes, edges, shared state, routing
+
+         |
+         v
+    P08  Draw your workflow as a graph
+         (explicit graph, parallel fan-out/fan-in,
+          rollback edges, human-in-the-loop)
 ```
 
 Each phase takes about a week if you're going part-time. If you want to go faster, phases 1–3 can be done in a long weekend.
@@ -348,7 +373,7 @@ Each phase takes about a week if you're going part-time. If you want to go faste
 
 ## Syllabus
 
-### Lectures — 13 conceptual units, each answering one core question
+### Lectures — 14 conceptual units, each answering one core question
 
 *Read the full text for each lecture on the [Documentation Website](https://walkinglabs.github.io/learn-harness-engineering/).*
 
@@ -367,8 +392,9 @@ Each phase takes about a week if you're going part-time. If you want to go faste
 | [L11](./docs/en/lectures/lecture-11-why-observability-belongs-inside-the-harness/index.md) | Why does observability belong inside the harness? | If you can't see what the agent did, you can't fix what it broke |
 | [L12](./docs/en/lectures/lecture-12-why-every-session-must-leave-a-clean-state/index.md) | Why must every session leave a clean state? | The next session's success depends on this session's cleanup |
 | [L13](./docs/en/lectures/lecture-13-loop-engineering/index.md) 
```

**File**: `docs-readme/ar-SA/README.md` (modified, +75/-31)
```diff
@@ -22,6 +22,21 @@
 
 تعلّم هندسة الحزام (Learn Harness Engineering) هي دورة تعليمية مكرّسة لهندسة وكلاء البرمجة بالذكاء الاصطناعي. لقد قمنا بدراسة وتوليف أحدث نظريات وممارسات هندسة الحزام في الصناعة بعمق. تشمل مراجعنا الأساسية:
 
+> **🆕 تحديث أغسطس 2026: هندسة الرسوم البيانية (Graph Engineering)** — محاضرة جديدة + مشروع جديد:
+>
+> - **المحاضرة 14** [من الحلقة الواحدة إلى هندسة الرسوم البيانية](../../docs/ar/lectures/lecture-14-graph-engineering/index.md): لماذا تنمو شبكة الرسوم حتمًا بعد حلقة واحدة — الطبقات الأربع المتكدسة (prompt → context → loop → graph) ومكان الحزام فيها، أجزاء الرسم الأربعة (العقد، الحواف، الحالة المشتركة، التوجيه)، لماذا لا تنقذ نقاط التحقق داخل الحلقة من الفشل البنيوي الثلاثة عند التوسع (Goodhart، العمى التصاعدي، التعارض)، الخطوات الست المستقلة عن الإطار لبناء أول رسم بياني لك، الفرق بين Graph وWorkflow، المراسي، وضع المشاريع مفتوحة المصدر قبل/بعد الإطلاق، ضريبة التنسيق، ومتى يستحق الرسم فعلًا.
+> - **المشروع 08** [ارسم سير عملك كرسم بياني](../../docs/ar/projects/project-08-graph-engineering-first-graph/index.md): ثلاث تجارب متتالية — رسم حلقة maker-checker كرسم صريح، إضافة عقد fan-out/fan-in متوازية، إضافة حافة تراجع شرطية وعقدة موافقة بشرية.
+>
+> **الفكرة الأساسية:** الحلقة هي رسم بياني بعقدة واحدة. عندما تتطلب المهمة تقسيم العمل والتوازي والحالة المشتركة والتحقق والاستعادة — لم تعد حلقة، بل رسمًا بيانيًا.
+>
+> **🆕 تحديث يوليو 2026: هندسة الحلقات (Loop Engineering)** — محاضرة جديدة + مشروع جديد + قوالب كود:
+>
+> - **المحاضرة 13** [لماذا تحتاج إلى التوقف عن مطالبة وكيلك](../../docs/ar/lectures/lecture-13-loop-engineering/index.md): من `/goal` إلى البدائيات الست لهندسة الحلقات (أتمتة، worktrees، مهارات، موصلات، وكلاء فرعيون، حالة خارجية)، فصل المولد/المقيّم، التكاليف الصامتة الأربعة، وبناء أول حلقة لك خطوة بخطوة.
+> - **المشروع 07** [ابنِ أول حلقة آلية](../../docs/ar/projects/project-07-loop-engineering-first-loop/index.md): ثلاث تجارب متتالية — حلقة الهدف، حلقة المؤقت، حلقة الصانع-المدقق. قارن اليدوي مقابل الآلي، قس تقلص التدخلات، وتعلم الخروج من الحلقة.
+> - **قوالب الكود**: `goal-template.md`، `loop-state-template.md`، `maker-prompt.md`، `checker-prompt.md` — قوالب جاهزة للبناء الفوري.
+>
+> **الفكرة الأساسية:** هندسة الحزام تصنع السيارة. هندسة الحلقات تصمم الطريق الذي تسير عليه — وأنت تصمم هذا الطريق من خارج السيارة.
+
 - [OpenAI: Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
 - [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
 - [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
@@ -195,15 +210,15 @@
 
 ينقسم المنهج إلى ثلاثة أجزاء:
 
-1. **المحاضرات**: 12 وحدة مفاهيمية تشرح النظرية وراء هندسة الحزام.
-2. **المشاريع**: 6 مشاريع عملية حيث تبني مساحة عمل وكيلية من الصفر.
+1. **المحاضرات**: 14 وحدة مفاهيمية تشرح النظرية وراء هندسة الحزام.
+2. **المشاريع**: 8 مشاريع عملية حيث تبني مساحة عمل وكيلية من الصفر.
 3. **مكتبة الموارد**: قوالب جاهزة للنسخ (`AGENTS.md`، `feature_list.json`، `init.sh`، إلخ) لاستخدامها في مستودعاتك الخاصة اليوم.
 
 ---
 
 ## ابدأ بسرعة: حسّن وكيلك اليوم
 
-لا تحتاج إلى قراءة جميع المحاضرات الـ 12 قبل أن تبدأ في الحصول على قيمة. إذا كنت تستخدم بالفعل وكيل برمجة في مشروع حقيقي، إليك كيفية تحسينه الآن.
+لا تحتاج إلى قراءة جميع المحاضرات الـ 14 قبل أن تبدأ في الحصول على قيمة. إذا كنت تستخدم بالفعل وكيل برمجة في مشروع حقيقي، إليك كيفية تحسينه الآن.
 
 الفكرة بسيطة: بدلاً من مجرد كتابة الموجهات، أعطِ وكيلك مجموعة من الملفات المنظمة التي تحدد ما يجب فعله، ما تم إنجازه، وكيفية التحقق من العمل. هذه الملفات تعيش داخل مستودعك، لذا تبدأ كل جلسة من نفس الحالة.
 
@@ -223,7 +238,7 @@
 
 ## مشروع التخرج: تطبيق حقيقي
 
-جميع مشاريع الدورة الستة تدور حول نفس المنتج: **تطبيق سطح مكتب لقاعدة المعرفة الشخصية مبني على Electron**.
+جميع مشاريع الدورة الثمانية تدور حول نفس المنتج: **تطبيق سطح مكتب لقاعدة المعرفة الشخصية مبني على Electron**.
 
 ```text
     ┌─────────────────────────────────────────────────────┐
@@ -304,6 +319,25 @@
          v                                     v
     P05  الوكيل يتحقق من عمله بنفسه          P06  ابنِ حزاماً كاملاً
                                                (مشروع التخرج)
+
+    المرحلة 7: أتمتة الحلقة
+    ==========================
+    L13  توقف عن مطالبة وكيلك —
+         صمم حلقات بدلاً من ذلك
+         |
+         v
+    P07  ابنِ أول حلقة آلية
+         (حلقة هدف، حلقة مؤقت، صانع-مدقق)
+
+    المرحلة 8: هيكلة النظام
+    =============================
+    L14  ارسم النظام كرسم بياني —
+         عقد، حواف، حالة مشتركة، توجيه
+         |
+         v
+    P08  ارسم سير عملك كرسم بياني
+         (رسم صريح، fan-out/fan-in متوازي،
+          حواف تراجع، تعاون بشري)
 ```
 
 كل مرحلة تستغرق حوالي أسبوع إذا كنت تعمل بدوام جزئي. إذا كنت تريد السرعة، يمكن إنجاز المراحل 1-3 في عطلة نهاية أسبوع طويلة.
@@ -312,35 +346,39 @@
 
 ## المنهج الدراسي
 
-### المحاضرات — 12 وحدة مفاهيمية، كل منها يجيب عن سؤال أس
```

**File**: `docs-readme/de-DE/README.md` (modified, +79/-31)
```diff
@@ -22,6 +22,21 @@
 
 Learn Harness Engineering ist ein Kurs, der sich der Entwicklung von KI-Coding-Agenten widmet. Wir haben die fortschrittlichsten Theorien und Praktiken des Harness Engineering in der Branche eingehend studiert und zusammengefasst. Unsere Kernreferenzen umfassen:
 
+> **🆕 August-2026-Update: Graph Engineering (Graph Engineering)** — 1 neue Vorlesung + 1 neues Projekt:
+>
+> - **Lektion 14** [Von Einzel-Loops zu Graph Engineering](../../docs/de/lectures/lecture-14-graph-engineering/index.md): warum ein einzelner Loop unweigerlich zu einem Graphen wird — die vier gestapelten Ebenen (prompt → context → loop → graph) und der Ort des Harness darin, die vier Teile eines Graphen (Knoten, Kanten, Shared State, Routing), warum Checkpoints innerhalb eines Loops die drei strukturellen Fehlschläge im Maßstab (Goodhart, Blindheit nach oben, Konflikt) nicht retten können, die framework-unabhängigen sechs Schritte zum Bauen deines ersten Graphen, der Unterschied zwischen Graph und Workflow, Anker, die Situation der Open-Source-Projekte vor vs. nach der Veröffentlichung, die Orchestration Tax — und wann ein Graph wirklich einen Graphen wert ist.
+> - **Projekt 08** [Zeichne deinen Workflow als Graph](../../docs/de/projects/project-08-graph-engineering-first-graph/index.md): drei fortschreitende Experimente — den Maker-Checker-Loop als expliziten Graphen zeichnen, einen parallelen Fan-out/Fan-in-Knoten hinzufügen, eine bedingte Rollback-Kante und einen menschlichen Freigabe-Knoten hinzufügen.
+>
+> **Kernaussage:** Ein Loop ist ein Graph mit nur einem Knoten. Sobald eine Aufgabe Arbeitsteilung, Parallelität, Shared State, Verifikation und Wiederherstellung braucht — ist sie kein Loop mehr, sondern ein Graph.
+>
+> **🆕 Juli-2026-Update: Loop Engineering (Loop Engineering)** — 1 neue Vorlesung + 1 neues Projekt + Code-Vorlagen:
+>
+> - **Lektion 13** [Warum du aufhören solltest, deinen Agenten zu prompten](../../docs/de/lectures/lecture-13-loop-engineering/index.md): von `/goal` zu den sechs Primitiven des Loop Engineering (automations, worktrees, skills, connectors, sub-agents, external state), Generator/Evaluator-Trennung, vier stille Kosten und der schrittweise Aufbau deines ersten Loops.
+> - **Projekt 07** [Baue deinen ersten automatisierten Loop](../../docs/de/projects/project-07-loop-engineering-first-loop/index.md): drei fortschreitende Experimente — Goal-Loop, Timer-Loop, Maker-Checker-Loop. Vergleiche manuell vs. automatisiert, miss die Reduktion der Eingriffe, lerne, den Loop zu verlassen.
+> - **Code-Vorlagen**: `goal-template.md`, `loop-state-template.md`, `maker-prompt.md`, `checker-prompt.md` — Plug-and-Play-Vorlagen zum Bauen von Loops.
+>
+> **Kernaussage:** Harness Engineering baut das Auto. Loop Engineering entwirft die Straße, auf der es fährt — und du entwirfst diese Straße von außerhalb des Wagens.
+
 - [OpenAI: Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
 - [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
 - [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
@@ -195,15 +210,15 @@ Die vollständigen Kursmaterialien finden Sie auf der **[Dokumentations-Website]
 
 Das Curriculum ist in drei Teile gegliedert:
 
-1. **Vorlesungen**: 12 konzeptionelle Einheiten, die die Theorie hinter dem Harness Engineering erklären.
-2. **Projekte**: 6 praktische Projekte, bei denen Sie einen agentenbasierten Arbeitsbereich von Grund auf neu aufbauen.
+1. **Vorlesungen**: 14 konzeptionelle Einheiten, die die Theorie hinter dem Harness Engineering erklären.
+2. **Projekte**: 8 praktische Projekte, bei denen Sie einen agentenbasierten Arbeitsbereich von Grund auf neu aufbauen.
 3. **Vorlagen-Bibliothek**: Kopierfertige Vorlagen (`AGENTS.md`, `feature_list.json`, `init.sh` usw.), die Sie noch heute in Ihren eigenen Repositories verwenden können.
 
 ---
 
 ## Schnellstart: Verbessern Sie Ihren Agenten noch heute
 
-Sie müssen nicht alle 12 Vorlesungen lesen, bevor Sie einen Nutzen ziehen. Wenn Sie bereits einen Coding-Agenten in einem echten Projekt einsetzen, können Sie ihn jetzt sofort verbessern.
+Sie müssen nicht alle 14 Vorlesungen lesen, bevor Sie einen Nutzen ziehen. Wenn Sie bereits einen Coding-Agenten in einem echten Projekt einsetzen, können Sie ihn jetzt sofort verbessern.
 
 Die Idee ist einfach: Anstatt nur Prompts zu schreiben, geben Sie Ihrem Agenten einen Satz strukturierter Dateien, die definieren, was zu tun ist, was bereits erledigt ist und wie die Arbeit verifiziert wird. Diese Dateien befinden sich in Ihrem Repo, sodass jede Session vom gleichen Zustand ausgeht.
 
@@ -223,7 +238,7 @@ Laden Sie sich die Starter-Vorlagen aus der [Vorlagen-Bibliothek](https://walkin
 
 ## Abschlussprojekt: Eine echte App
 
-Alle sechs Kursprojekte drehen sich u
```

**File**: `docs-readme/es-ES/README.md` (modified, +77/-31)
```diff
@@ -22,6 +22,21 @@
 
 Learn Harness Engineering es un curso dedicado a la ingeniería de agentes de codificación de IA. Hemos estudiado y sintetizado en profundidad las teorías y prácticas más avanzadas de Harness Engineering en la industria. Nuestras referencias principales incluyen:
 
+> **🆕 Actualización de agosto de 2026: Ingeniería de Grafos (Graph Engineering)** — 1 clase nueva + 1 proyecto nuevo:
+>
+> - **Lección 14** [De los Loops Únicos a la Ingeniería de Grafos](../../docs/es/lectures/lecture-14-graph-engineering/index.md): por qué un loop único inevitablemente se convierte en un grafo — las cuatro capas apiladas (prompt → context → loop → graph) y el lugar del harness en ellas, las cuatro piezas del grafo (nodos, aristas, estado compartido, routing), por qué los checkpoints dentro de un loop no salvan los tres fallos estructurales a escala (Goodhart, ceguera hacia arriba, conflicto), los seis pasos independientes del framework para construir tu primer grafo, la diferencia entre Grafo y Workflow, las anclas, el estado actual de los proyectos open source anteriores vs. posteriores al concepto, el impuesto de orquestación, y cuándo realmente vale la pena dibujar un grafo.
+> - **Proyecto 08** [Dibuja tu flujo de trabajo como un grafo](../../docs/es/projects/project-08-graph-engineering-first-graph/index.md): tres experimentos progresivos — dibujar el loop maker-checker como un grafo explícito, añadir nodos paralelos de fan-out/fan-in, y añadir aristas de retroceso condicionales y un nodo de aprobación humana.
+>
+> **Idea clave:** Un loop es un grafo con un solo nodo. Cuando la tarea necesita especialización, paralelismo, estado compartido, verificación y recuperación — deja de ser un loop y se convierte en un grafo.
+>
+> **🆕 Actualización de julio de 2026: Ingeniería de Loops (Loop Engineering)** — 1 clase nueva + 1 proyecto nuevo + plantillas de código:
+>
+> - **Lección 13** [Del Prompting Manual a los Loops Autónomos](../../docs/es/lectures/lecture-13-loop-engineering/index.md): de `/goal` a los seis primitivos del loop engineering (Automations, Worktrees, Skills, Connectors, Sub-agentes, Estado Externo), la separación Generador/Evaluador, los cuatro costes silenciosos, y la construcción paso a paso de tu primer loop.
+> - **Proyecto 07** [Construye Tu Primer Loop Automatizado](../../docs/es/projects/project-07-loop-engineering-first-loop/index.md): tres experimentos progresivos — loop de objetivo, loop de temporizador, loop maker-checker. Comparar manual vs. automatizado, medir la reducción de intervención, aprender a salir del loop.
+> - **Plantillas de código**: `goal-template.md`, `loop-state-template.md`, `maker-prompt.md`, `checker-prompt.md` — plantillas listas para usar para construir loops.
+>
+> **Idea clave:** La ingeniería de harness construye el vehículo. La ingeniería de loops diseña la carretera por la que circula — y tú diseñas esa carretera desde fuera del vehículo.
+
 - [OpenAI: Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
 - [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
 - [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
@@ -195,15 +210,15 @@ Para ver todos los materiales del curso, visita el **[Sitio de Documentación](h
 
 El plan de estudios se divide en tres partes:
 
-1. **Clases**: 12 unidades conceptuales que explican la teoría detrás de Harness Engineering.
-2. **Proyectos**: 6 proyectos prácticos donde construyes un espacio de trabajo para agentes desde cero.
+1. **Clases**: 14 unidades conceptuales que explican la teoría detrás de Harness Engineering.
+2. **Proyectos**: 8 proyectos prácticos donde construyes un espacio de trabajo para agentes desde cero.
 3. **Biblioteca de Recursos**: Plantillas listas para copiar (`AGENTS.md`, `feature_list.json`, `init.sh`, etc.) para usar en tus propios repositorios hoy mismo.
 
 ---
 
 ## Inicio Rápido: Mejora tu agente hoy mismo
 
-No necesitas leer las 12 clases antes de empezar a obtener valor. Si ya estás usando un agente de codificación en un proyecto real, aquí tienes cómo mejorarlo ahora mismo.
+No necesitas leer las 14 clases antes de empezar a obtener valor. Si ya estás usando un agente de codificación en un proyecto real, aquí tienes cómo mejorarlo ahora mismo.
 
 La idea es simple: en lugar de solo escribir prompts, dale a tu agente un conjunto de archivos estructurados que definan qué hacer, qué se ha hecho y cómo verificar el trabajo. Estos archivos viven dentro de tu repositorio, así que cada sesión comienza desde el mismo estado.
 
@@ -223,7 +238,7 @@ Obtén las plantillas iniciales de la [Biblioteca de Recursos](https://walkingla
 
 ## Proyecto Final: Una aplicación real
 
-Los seis proyectos del curso giran en torno al mismo producto: **una aplicación de escritorio
```

**File**: `docs-readme/fr-FR/README.md` (modified, +79/-31)
```diff
@@ -22,6 +22,21 @@
 
 Learn Harness Engineering est un cours dédié à l'ingénierie des agents de codage IA. Nous avons étudié et synthétisé en profondeur les théories et pratiques les plus avancées en matière de Harness Engineering dans l'industrie. Nos références principales incluent :
 
+> **🆕 Mise à jour d'août 2026 : Ingénierie des graphes (Graph Engineering)** — 1 nouveau cours + 1 nouveau projet :
+>
+> - **Cours 14** [Des boucles simples à l'ingénierie des graphes](../../docs/fr/lectures/lecture-14-graph-engineering/index.md) : pourquoi une boucle unique devient naturellement un graphe — la pile à quatre couches (prompt → context → loop → graph) et la place du harness dans celle-ci, les quatre composants d'un graphe (nœuds, arêtes, état partagé, routage), pourquoi les points de contrôle dans un loop ne sauvent pas les trois échecs structurels qui surviennent à l'échelle (Goodhart, cécité vers le haut, conflit), les six étapes indépendantes de tout framework pour construire votre premier graphe, la différence entre Graph et Workflow, les ancres, l'état des projets open source avant vs après la publication, la taxe d'orchestration, et le moment où il vaut réellement la peine de dessiner un graphe.
+> - **Projet 08** [Dessinez votre workflow sous forme de graphe](../../docs/fr/projects/project-08-graph-engineering-first-graph/index.md) : trois expériences progressives — dessiner le loop maker-checker comme un graphe explicite, ajouter un nœud de fan-out/fan-in parallèle, ajouter une arête de retour arrière conditionnelle et un nœud d'approbation humaine.
+>
+> **Idée centrale :** Un loop est un graphe à un seul nœud. Quand une tâche exige la spécialisation, le parallélisme, l'état partagé, la vérification et la récupération — ce n'est plus un loop, c'est un graphe.
+>
+> **🆕 Mise à jour de juillet 2026 : Ingénierie des boucles (Loop Engineering)** — 1 nouveau cours + 1 nouveau projet + des modèles de code :
+>
+> - **Cours 13** [Pourquoi vous devez arrêter de faire du prompting à vos agents vous-même](../../docs/fr/lectures/lecture-13-loop-engineering/index.md) : de `/goal` aux six primitives de l'ingénierie des boucles (automations, worktrees, skills, connecteurs, sous-agents, état externe), la séparation générateur/évaluateur, quatre coûts silencieux, et la construction progressive de votre première boucle.
+> - **Projet 07** [Construisez votre première boucle automatisée](../../docs/fr/projects/project-07-loop-engineering-first-loop/index.md) : trois expériences progressives — boucle par but, boucle temporelle, boucle maker-checker. Comparer manuel vs. automatisé, mesurer la réduction des interventions, apprendre à sortir de la boucle.
+> - **Modèles de code** : `goal-template.md`, `loop-state-template.md`, `maker-prompt.md`, `checker-prompt.md` — des modèles de construction de boucles prêts à l'emploi.
+>
+> **Idée centrale :** Le Harness Engineering construit la voiture. L'ingénierie des boucles conçoit la route sur laquelle elle roule — et vous concevez cette route depuis l'extérieur de la voiture.
+
 - [OpenAI : Harness engineering : leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
 - [Anthropic : Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
 - [Anthropic : Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
@@ -195,15 +210,15 @@ Pour l'ensemble des matériaux du cours, veuillez visiter le **[Site de Document
 
 Le programme est divisé en trois parties :
 
-1. **Cours magistraux** : 12 unités conceptuelles expliquant la théorie derrière le Harness Engineering.
-2. **Projets** : 6 projets pratiques où vous construisez un espace de travail agentique à partir de zéro.
+1. **Cours magistraux** : 14 unités conceptuelles expliquant la théorie derrière le Harness Engineering.
+2. **Projets** : 8 projets pratiques où vous construisez un espace de travail agentique à partir de zéro.
 3. **Bibliothèque de Ressources** : Des modèles prêts à copier (`AGENTS.md`, `feature_list.json`, `init.sh`, etc.) à utiliser dans vos propres dépôts dès aujourd'hui.
 
 ---
 
 ## Démarrage Rapide : Améliorez votre agent dès aujourd'hui
 
-Vous n'avez pas besoin de lire les 12 cours avant de commencer à en tirer profit. Si vous utilisez déjà un agent de codage sur un vrai projet, voici comment l'améliorer dès maintenant.
+Vous n'avez pas besoin de lire les 14 cours avant de commencer à en tirer profit. Si vous utilisez déjà un agent de codage sur un vrai projet, voici comment l'améliorer dès maintenant.
 
 L'idée est simple : au lieu de simplement écrire des prompts, donnez à votre agent un ensemble de fichiers structurés qui définissent ce qu'il faut faire, ce qui a été fait et comment vérifier le travail. Ces fichiers résident dans votre dépôt, donc chaque session démarre depuis le même état.
 
@@ -223,7 +238,7 @@ Récupérez les
```

**File**: `docs-readme/ja-JP/README.md` (modified, +75/-31)
```diff
@@ -22,6 +22,21 @@
 
 Learn Harness Engineering は、AIコーディングエージェントのエンジニアリングに特化したコースです。業界最先端の Harness Engineering の理論と実践を深く研究し、統合しました。主な参考文献は以下の通りです：
 
+> **🆕 2026年8月更新：グラフエンジニアリング（Graph Engineering）**——講義1回 + プロジェクト1つを追加：
+>
+> - **第14回** [単一ループからグラフエンジニアリングへ](../../docs/ja/lectures/lecture-14-graph-engineering/index.md)：なぜ単一ループの先に必ずグラフが生まれるのか——4層の重ね合わせ（prompt → context → loop → graph）とharnessの位置、グラフの4つの部品（ノード、エッジ、共有状態、ルーティング）、loop内のチェックポイントが規模上の3つの構造的失敗（Goodhart、上方向の失明、衝突）を救えない理由、フレームワーク非依存の6ステップで最初のグラフを構築する手順、GraphとWorkflowの違い、アンカー、公開前 vs 公開後のオープンソースプロジェクトの現状、オーケストレーション税、そして本当に図を描く価値があるとき。
+> - **プロジェクト 08** [ワークフローをグラフとして描く](../../docs/ja/projects/project-08-graph-engineering-first-graph/index.md)：3つの発展的な実験——maker-checker loopを明示的なグラフに描く、並列のfan-out/fan-inノードを追加する、条件付きフォールバックエッジと人間による承認ノードを追加する。
+>
+> **コアとなる見解：** Loopはノードが1つだけのグラフである。タスクが分業、並列、共有状態、検証、リカバリを必要とするとき——それはもはやloopではなく、グラフになる。
+>
+> **🆕 2026年7月更新：ループエンジニアリング（Loop Engineering）**——講義1回 + プロジェクト1つ + コードテンプレートを追加：
+>
+> - **第13回** [なぜあなたはエージェントにプロンプトを与えるのをやめるべきか](../../docs/ja/lectures/lecture-13-loop-engineering/index.md)：`/goal` からループエンジニアリングの6つのプリミティブ（automations、worktrees、skills、connectors、sub-agents、external state）、生成者/評価者の分離、4つの静かなコスト、そして最初のループを段階的に構築する手順。
+> - **プロジェクト 07** [初めての自動ループを構築する](../../docs/ja/projects/project-07-loop-engineering-first-loop/index.md)：3つの発展的な実験——目標ループ、タイマーループ、maker-checkerループ。手動 vs 自動化の比較、介入の減少の測定、ループから抜け出すことを学ぶ。
+> - **コードテンプレート**：`goal-template.md`、`loop-state-template.md`、`maker-prompt.md`、`checker-prompt.md`——プラグアンドプレイのループ構築テンプレート。
+>
+> **コアとなる見解：** Harnessエンジニアリングは車を作る。ループエンジニアリングはその走る道路を設計する——そしてあなたは車の外から道路を設計する。
+
 - [OpenAI: Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
 - [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
 - [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
@@ -194,15 +209,15 @@ Harness Engineering は、モデルの周囲に完全な作業環境を構築し
 
 カリキュラムは3つの部分に分かれています：
 
-1. **レクチャー**：Harness Engineering の背景理論を説明する12の概念ユニット。
-2. **プロジェクト**：ゼロからエージェントワークスペースを構築する6つのハンズオンプロジェクト。
+1. **レクチャー**：Harness Engineering の背景理論を説明する14の概念ユニット。
+2. **プロジェクト**：ゼロからエージェントワークスペースを構築する8つのハンズオンプロジェクト。
 3. **リソースライブラリ**：自分のリポジトリで今日すぐ使えるコピー用テンプレート（`AGENTS.md`、`feature_list.json`、`init.sh` など）。
 
 ---
 
 ## クイックスタート：今日からエージェントを改善する
 
-価値を得るために12のレクチャーをすべて読む必要はありません。すでに実際のプロジェクトでコーディングエージェントを使用している場合、今すぐ改善する方法は以下の通りです。
+価値を得るために14のレクチャーをすべて読む必要はありません。すでに実際のプロジェクトでコーディングエージェントを使用している場合、今すぐ改善する方法は以下の通りです。
 
 アイデアはシンプルです：プロンプトを書く代わりに、何をすべきか、何が完了しているか、作業をどう検証するかを定義する構造化ファイルのセットをエージェントに与えます。これらのファイルはリポジトリ内に存在するため、すべてのセッションが同じ状態から始まります。
 
@@ -222,7 +237,7 @@ Harness Engineering は、モデルの周囲に完全な作業環境を構築し
 
 ## カプロジェクト：実際のアプリケーション
 
-6つのコースプロジェクトはすべて同じ製品を中心に展開しています：**Electron ベースの個人ナレッジベースデスクトップアプリ**です。
+8つのコースプロジェクトはすべて同じ製品を中心に展開しています：**Electron ベースの個人ナレッジベースデスクトップアプリ**です。
 
 ```text
     ┌─────────────────────────────────────────────────────┐
@@ -303,6 +318,25 @@ Harness Engineering は、モデルの周囲に完全な作業環境を構築し
          v                                         v
     P05  エージェントが自分の作業を検証          P06  完全なハーネスを構築
                                                    （カプロジェクト）
+
+    フェーズ7: 自動化ループ
+    ==========================
+    L13  エージェントにプロンプトを
+         与えるのをやめる——ループを設計する
+         |
+         v
+    P07  初めての自動ループを構築する
+         （目標ループ、タイマーループ、maker-checker）
+
+    フェーズ8: システムを構造化
+    ============================
+    L14  システムをグラフとして描く——
+         ノード、エッジ、共有状態、ルーティング
+         |
+         v
+    P08  ワークフローをグラフとして描く
+         （明示グラフ、並列 fan-out/fan-in、
+          フォールバックエッジ、人間と機械の協働）
 ```
 
 パートタイムで進める場合、各フェーズは約1週間です。より速く進めたい場合、フェーズ1〜3は長い週末で完了できます。
@@ -311,35 +345,39 @@ Harness Engineering は、モデルの周囲に完全な作業環境を構築し
 
 ## シラバス
 
-### レクチャー — 12の概念ユニット、それぞれが一つのコアな問いに答える
+### レクチャー — 14の概念ユニット、それぞれが一つのコアな問いに答える
 
 *各レクチャーの全文は[ドキュメントウェブサイト](https://walkinglabs.github.io/learn-harness-engineering/)で読めます。*
 
 | セッション | 問い | コアアイデア |
 |---------|----------|-----------|
-| [L01](../../docs/en/lectures/lecture-01-why-capable-agents-still-fail/index.md) | なぜ強力なモデルでも実際のタスクで失敗するのか？ | ベンチマークと実際のエンジニアリングの能力格差 |
-| [L02](../../docs/en/lectures/lecture-02-what-a-harness-actually-is/index.md) | 「ハーネス」とは実際何を意味するのか？ | 5つのサブシステム：インストラクション、状態、検証、スコープ、ライフサイクル |
-| [L03](../../docs/en/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md) | なぜリポジトリが唯一の信頼できる情報源でなければならないのか？ | エージェントが見られないものは存在しない |
-| [L04](../../docs/en/lectures/lecture-04-why-one-giant-instruction-file-fails/index.md) | なぜ一つの巨大な指示ファイルは失敗するのか？ | 段階的開示：百科事典ではなく地図を与える |
-| [L05](../../docs/en/lectures/lecture-05-why-long-running-tasks-lose-continuity/index.md) | なぜ長時間実行タスクは連続性を失うのか？ | 進捗をディスクに永続化し、前回の続きから再開する |
-| [L06](../../docs/en/lectures/lecture-06-why-initialization-needs-its-own-phase/index.md) | なぜ初期化に独自のフェーズが必要なのか？ | エージェントが作業を開始する前に環
```

**File**: `docs-readme/ko-KR/README.md` (modified, +75/-31)
```diff
@@ -22,6 +22,21 @@
 
 Learn Harness Engineering은 AI 코딩 에이전트의 엔지니어링에 집중하는 강좌입니다. 업계에서 가장 선진적인 Harness Engineering 이론과 실무를 심층적으로 연구하고 종합했습니다. 핵심 참고 자료는 다음과 같습니다:
 
+> **🆕 2026년 8월 업데이트: 그래프 엔지니어링(Graph Engineering)** — 강의 1개 + 프로젝트 1개 추가:
+>
+> - **제14강** [단일 루프에서 그래프 엔지니어링으로](../../docs/ko/lectures/lecture-14-graph-engineering/index.md): 왜 단일 루프는 반드시 그래프로 자라나는가 — 4층 겹침(prompt → context → loop → graph)과 harness의 위치, 그래프의 네 부품(노드, 엣지, 공유 상태, 라우팅), 왜 루프 안의 체크포인트는 규모에서의 세 가지 구조적 실패(Goodhart, 위쪽 실명, 충돌)를 구하지 못하는지, 프레임워크 무관의 여섯 단계로 첫 그래프 구축, Graph와 Workflow의 차이, 앵커, 출시 전/후 오픈소스 프로젝트 현황, 오케스트레이션 세금, 그리고 언제 정말로 그래프를 그릴 가치가 있는지.
+> - **프로젝트 08** [내 워크플로우를 그래프로 그리기](../../docs/ko/projects/project-08-graph-engineering-first-graph/index.md): 세 가지 단계 실험 — maker-checker loop을 명시적 그래프로 그리기, 병렬 fan-out/fan-in 노드 추가, 조건부 롤백 엣지와 인간 승인 노드 추가.
+>
+> **핵심 관점:** Loop은 노드가 하나뿐인 그래프입니다. 작업이 분업, 병렬, 공유 상태, 검증, 복구를 필요로 하는 순간 — 그것은 더 이상 loop이 아니라 그래프입니다.
+>
+> **🆕 2026년 7월 업데이트: 루프 엔지니어링(Loop Engineering)** — 강의 1개 + 프로젝트 1개 + 코드 템플릿 추가:
+>
+> - **제13강** [왜 당신의 에이전트에게 직접 프롬프팅하는 것을 멈춰야 하는가](../../docs/ko/lectures/lecture-13-loop-engineering/index.md): `/goal`에서 루프 엔지니어링의 여섯 가지 원시(automations, worktrees, skills, connectors, sub-agents, external state), 생성자/평가자 분리, 네 가지 조용한 비용, 그리고 첫 루프 단계별 구축.
+> - **프로젝트 07** [첫 번째 자동 루프 구축하기](../../docs/ko/projects/project-07-loop-engineering-first-loop/index.md): 세 가지 단계 실험 — 목표 루프, 예약 루프, 메이커-체커 루프. 수동 vs 자동 비교, 개입 감소 측정, 루프 밖으로 나가는 법 배우기.
+> - **코드 템플릿**: `goal-template.md`, `loop-state-template.md`, `maker-prompt.md`, `checker-prompt.md` — 바로 사용 가능한 루프 구축 템플릿.
+>
+> **핵심 관점:** Harness 엔지니어링은 차를 만듭니다. 루프 엔지니어링은 그것이 달리는 도로를 설계합니다 — 그리고 당신은 차 밖에서 그 도로를 설계해야 합니다.
+
 - [OpenAI: Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
 - [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
 - [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
@@ -195,15 +210,15 @@ Harness engineering은 모델 주변에 안정적인 결과를 생성하는 완
 
 과정은 세 부분으로 나뉩니다:
 
-1. **강의(Lectures)**: Harness engineering 이론을 설명하는 12개의 개념적 단원.
-2. **프로젝트(Projects)**: 처음부터 에이전트 작업 공간을 구축하는 6개의 실습 프로젝트.
+1. **강의(Lectures)**: Harness engineering 이론을 설명하는 14개의 개념적 단원.
+2. **프로젝트(Projects)**: 처음부터 에이전트 작업 공간을 구축하는 8개의 실습 프로젝트.
 3. **리소스 라이브러리**: 여러분의 저장소에 오늘 바로 사용할 수 있는 복사 가능 템플릿(`AGENTS.md`, `feature_list.json`, `init.sh` 등).
 
 ---
 
 ## 빠른 시작: 오늘 바로 에이전트 개선하기
 
-12개의 강의를 모두 읽고 나서 가치를 얻기 시작할 필요가 없습니다. 이미 실제 프로젝트에서 코딩 에이전트를 사용하고 있다면, 지금 당장 개선하는 방법은 다음과 같습니다.
+14개의 강의를 모두 읽고 나서 가치를 얻기 시작할 필요가 없습니다. 이미 실제 프로젝트에서 코딩 에이전트를 사용하고 있다면, 지금 당장 개선하는 방법은 다음과 같습니다.
 
 핵심 아이디어는 간단합니다: 프롬프트만 작성하는 대신, 무엇을 해야 하는지, 무엇이 완료되었는지, 작업을 어떻게 검증할지 정의하는 구조화된 파일 세트를 에이전트에 제공하세요. 이 파일들은 저장소 내에 있으므로 모든 세션이 동일한 상태에서 시작합니다.
 
@@ -223,7 +238,7 @@ Harness engineering은 모델 주변에 안정적인 결과를 생성하는 완
 
 ## 캡스톤 프로젝트: 실제 앱
 
-6개의 강좌 프로젝트는 모두 동일한 제품을 중심으로 전개됩니다: **Electron 기반 개인 지식 베이스 데스크톱 앱**.
+8개의 강좌 프로젝트는 모두 동일한 제품을 중심으로 전개됩니다: **Electron 기반 개인 지식 베이스 데스크톱 앱**.
 
 ```text
     ┌─────────────────────────────────────────────────────┐
@@ -301,6 +316,25 @@ Harness engineering은 모델 주변에 안정적인 결과를 생성하는 완
          v                                     v
     P05  에이전트가 자체 검증                 P06  완전한 하니스 구축
                                                   (캡스톤 프로젝트)
+
+    7단계: 자동화 루프
+    ==========================
+    L13  에이전트에게 프롬프팅하는 것을
+         멈추고 루프를 설계하자
+         |
+         v
+    P07  첫 번째 자동 루프 구축하기
+         (목표 루프, 예약 루프, 메이커-체커)
+
+    8단계: 시스템 구조화
+    =============================
+    L14  시스템을 그래프로 그리기—
+         노드, 엣지, 공유 상태, 라우팅
+         |
+         v
+    P08  내 워크플로우를 그래프로 그리기
+         (명시적 그래프, 병렬 fan-out/fan-in,
+          롤백 엣지, 인간-기계 협력)
 ```
 
 파트타임으로 진행하면 각 단계는 약 1주일이 소요됩니다. 더 빠르게 진행하고 싶다면 1~3단계는 긴 주말에 완료할 수 있습니다.
@@ -309,35 +343,39 @@ Harness engineering은 모델 주변에 안정적인 결과를 생성하는 완
 
 ## 강의 개요
 
-### 강의 — 각각 하나의 핵심 질문에 답하는 12개의 개념적 단원
+### 강의 — 각각 하나의 핵심 질문에 답하는 14개의 개념적 단원
 
 *각 강의의 전체 내용은 [문서 웹사이트](https://walkinglabs.github.io/learn-harness-engineering/)에서 읽을 수 있습니다.*
 
 | 세션 | 질문 | 핵심 아이디어 |
 |---------|----------|-----------|
-| [L01](../../docs/en/lectures/lecture-01-why-capable-agents-still-fail/index.md) | 왜 강력한 모델도 실제 작업에서 여전히 실패하는가? | 벤치마크와 실제 엔지니어링 사이의 역량 격차 |
-| [L02](../../docs/en/lectures/lecture-02-what-a-harness-actually-is/index.md) | "하니스"는 실제로 무엇을 의미하는가? | 다섯 가지 하위 시스템: 지시 사항, 상태, 검증, 범위, 수명 주기 |
-| [L03](../../docs/en/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/index.md) | 왜 저장소가 단일 진실 공급원이어야 하는가? | 에이전트가 볼 수 없다면 존재하지 않는 것과 같다 |
-| [L04](../../docs/en/lectures/lecture-04-why-one-giant-instruction-file-fails/index.md) | 왜 거대한 단일 지시 파일은 실패하는가? | 점진적 공개: 백과사전이 아닌 지도를 제공하라 |
-| [L05](../../docs/en/lectures/lecture-05-why-long-running-tasks-lose-continuity/index.md) | 왜 장기 실행 작업은 연속성을 잃는가? | 진행 상황을 디스크에 영속화
```

#### Recent Merged Pull Requests:
- **PR #83** (2026-10-01): design: replace abstract learning maps with readable course outlines (@sanbuphy)
- **PR #82** (2026-10-01): design: localize README illustrations across all languages (@sanbuphy)
- **PR #81** (2026-10-01): design: refresh README visuals across all 15 languages (@sanbuphy)
- **PR #80** (2026-09-30): docs: 用真实量化案例替换第 3–5 讲的无出处数字 (@sanbuphy)
- **PR #79** (2026-09-30): Fix file path in execution comment (@zhems)
- **PR #78** (2026-09-30): fix(audit-harness): close two false-PASS checks in Subsystem 1 (@trieuvo-web)
- **PR #76** (2026-09-30): Fix language switch losing the section anchor (@alecchen)
- **PR #75** (2026-09-30): docs: add sources or mark illustrative for Real-World examples (#73) (@PerryLink)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
