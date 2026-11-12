# Source Evidence Dossier: SYNTH-E3-137-CD-644A
- **Title**: resolve compatibility crashes by implementing required adapter methods, fixing t
- **Repository**: AhmadHassan-BTed/OpenOPC-Shadow-Adapter
- **Source Commit**: f38d1e5c
- **Parent Dossier**: 07_PROJECT_LEARNING/ahmadhassan-bted-openopc-shadow-adapter-learnings.md
- **Primary Domain**: D (Research & Knowledge Intelligence)
- **Mechanism**: Software Adapter Interface Defense & Property Mapping

---

## Forensic Source Excerpt

```
useSubmitTask.ts`
```
import { useState } from 'react';
import { api } from '../api/client';
import { TaskSubmitResponse } from '../types';

export interface UseSubmitTaskResult {
  submitTask: (taskId: string, deliverableText: string, files: File[]) => Promise<TaskSubmitResponse | null>;
  submitting: boolean;
  error: string | null;
  isSuccess: boolean;
  successMessage: string | null;
  reset: () => void;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 10;
const MAX_TOTAL_SIZE_MB = 50;

export const useSubmitTask = (): UseSubmitTaskResult => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const reset = () => {
    setSubmitting(false);
    setError(null);
    setIsSuccess(false);
    setSuccessMessage(null);
  };

  const submitTask = async (
    taskId: string,
    deliverableText: string,
    files: File[]
  ): Promise<TaskSubmitResponse | null> => {
    setError(null);

    if (!deliverableText.trim() && files.length === 0) {
      setError('Please provide deliverable text or attach at least one file.');
      return null;
    }

    if (files.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed per submission. You selected ${files.length}.`);
      return null;
    }

    let totalSize = 0;
    for (const f of files) {
      const sizeMB = f.size / (1024 * 1024);
      if (sizeMB > MAX_FILE_SIZE_MB) {
        setError(`File "${f.name}" exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB.`);
        return null;
      }
      totalSize += f.size;
    }

    if (totalSize / (1024 * 
```
