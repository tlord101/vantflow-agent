'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useWebSocketEvent } from '@/hooks/useWebSocket';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  PlayIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  StopIcon,
  EyeIcon 
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface RunsTabProps {
  projectId: string;
  project: any;
}

export default function RunsTab({ projectId, project }: RunsTabProps) {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    loadRuns();
  }, [projectId]);

  useEffect(() => {
    if (selectedRun) {
      loadRunLogs(selectedRun.id);
    }
  }, [selectedRun]);

  // Listen for real-time run updates
  useWebSocketEvent('run:started', (data) => {
    if (data.projectId === projectId) {
      loadRuns();
    }
  });

  useWebSocketEvent('run:progress', (data) => {
    if (selectedRun && data.runId === selectedRun.id) {
      setSelectedRun((prev: any) => ({
        ...prev,
        progress: data.progress,
      }));
    }
  });

  useWebSocketEvent('run:completed', (data) => {
    if (data.projectId === projectId) {
      loadRuns();
      toast.success('Run completed successfully!');
    }
  });

  useWebSocketEvent('run:failed', (data) => {
    if (data.projectId === projectId) {
      loadRuns();
      toast.error('Run failed');
    }
  });

  useWebSocketEvent('run:log', (log) => {
    if (selectedRun && log.runId === selectedRun.id) {
      setLogs((prev) => [...prev, log]);
    }
  });

  const loadRuns = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/${projectId}/runs`);
      setRuns(response.data.runs || []);
    } catch (error) {
      console.error('Error loading runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRunLogs = async (runId: string) => {
    try {
      const response = await api.get(`/runs/${runId}/logs`);
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const handleCancelRun = async (runId: string) => {
    if (!confirm('Are you sure you want to cancel this run?')) return;

    try {
      await api.post(`/runs/${runId}/cancel`);
      toast.success('Run cancelled');
      loadRuns();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel run');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any }> = {
      queued: { color: 'bg-gray-100 text-gray-800', icon: ClockIcon },
      running: { color: 'bg-blue-100 text-blue-800', icon: PlayIcon },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircleIcon },
      cancelled: { color: 'bg-orange-100 text-orange-800', icon: StopIcon },
    };

    const badge = badges[status] || badges.queued;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-4 w-4 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getLogLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      info: 'text-blue-600',
      warn: 'text-yellow-600',
      error: 'text-red-600',
      debug: 'text-gray-600',
    };
    return colors[level] || 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedRun) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Run Details</h3>
            <p className="text-sm text-gray-500 mt-1">
              {selectedRun.plan?.name} • {format(new Date(selectedRun.createdAt), 'PPpp')}
            </p>
          </div>
          <button
            onClick={() => setSelectedRun(null)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Back to list
          </button>
        </div>

        <div className="px-6 py-4">
          {/* Status and Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>{getStatusBadge(selectedRun.status)}</div>
              {selectedRun.duration && (
                <span className="text-sm text-gray-500">
                  Duration: {(selectedRun.duration / 1000).toFixed(2)}s
                </span>
              )}
            </div>

            {selectedRun.status === 'running' && selectedRun.progress !== undefined && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{selectedRun.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${selectedRun.progress}%` }}
                  />
                </div>
              </div>
            )}

            {selectedRun.errorMessage && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{selectedRun.errorMessage}</p>
              </div>
            )}
          </div>

          {/* Logs */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Execution Logs</h4>
            <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-gray-400">No logs yet...</p>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={log.id || index} className="text-gray-300">
                      <span className="text-gray-500">
                        [{format(new Date(log.timestamp), 'HH:mm:ss')}]
                      </span>
                      <span className={`ml-2 ${getLogLevelColor(log.level)}`}>
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="ml-2">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Artifacts */}
          {selectedRun.artifacts && selectedRun.artifacts.items?.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Artifacts</h4>
              <div className="grid grid-cols-2 gap-4">
                {selectedRun.artifacts.items.map((artifact: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-900">{artifact.type}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {artifact.size ? `${(artifact.size / 1024).toFixed(2)} KB` : 'N/A'}
                    </p>
                    {artifact.url && (
                      <a
                        href={artifact.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 mt-2 inline-block"
                      >
                        View →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {['queued', 'running'].includes(selectedRun.status) && (
            <div className="mt-6">
              <button
                onClick={() => handleCancelRun(selectedRun.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <StopIcon className="h-5 w-5 inline mr-2" />
                Cancel Run
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Execution History</h3>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-12">
          <PlayIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No runs yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Execute a plan to see results here
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {runs.map((run) => (
            <li key={run.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-sm font-medium text-gray-900">
                      {run.plan?.name || 'Unknown Plan'}
                    </h4>
                    {getStatusBadge(run.status)}
                  </div>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span>Started {formatDistanceToNow(new Date(run.createdAt))} ago</span>
                    {run.duration && (
                      <span>{(run.duration / 1000).toFixed(2)}s</span>
                    )}
                    {run._count?.logs > 0 && (
                      <span>{run._count.logs} log entries</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => setSelectedRun(run)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="View details"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  {['queued', 'running'].includes(run.status) && (
                    <button
                      onClick={() => handleCancelRun(run.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Cancel run"
                    >
                      <StopIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
