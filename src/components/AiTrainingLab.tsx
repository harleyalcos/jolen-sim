import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  type PlannerWeights,
  type TrainingDataPoint,
  DEFAULT_PLANNER_WEIGHTS,
  loadChampionWeights,
  saveChampionWeights,
  resetChampionWeights,
  loadTrainingHistory,
  saveTrainingHistory,
  clearTrainingHistory,
} from '../weights.ts';
import { TrainingChart } from './TrainingChart.tsx';
import { WeightsInspector } from './WeightsInspector.tsx';

interface AiTrainingLabProps {
  activeWeights: PlannerWeights;
  onApplyChampion: (weights: PlannerWeights) => void;
}

export const AiTrainingLab: React.FC<AiTrainingLabProps> = ({
  activeWeights,
  onApplyChampion,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [history, setHistory] = useState<TrainingDataPoint[]>(() => loadTrainingHistory());
  const [championWeights, setChampionWeights] = useState<PlannerWeights>(() => loadChampionWeights());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    const worker = new Worker(new URL('../training.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const { type, payload } = e.data ?? {};

      if (type === 'GENERATION_UPDATE' && payload) {
        const point = payload as TrainingDataPoint;
        setHistory((prev) => {
          const next = [...prev, point];
          // Keep up to 200 data points in memory and localStorage
          const trimmed = next.length > 200 ? next.slice(next.length - 200) : next;
          saveTrainingHistory(trimmed);
          return trimmed;
        });

        if (point.championWeights) {
          setChampionWeights(point.championWeights);
          saveChampionWeights(point.championWeights);
        }
      } else if (type === 'RESET_COMPLETE') {
        setHistory([]);
        clearTrainingHistory();
        resetChampionWeights();
        setChampionWeights({ ...DEFAULT_PLANNER_WEIGHTS });
        setIsRunning(false);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      type: 'START',
      payload: { initialWeights: championWeights },
    });
    setIsRunning(true);
    setStatusMessage('Simulation running in background Web Worker...');
    setTimeout(() => setStatusMessage(null), 3500);
  }, [championWeights]);

  const handlePause = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: 'PAUSE' });
    setIsRunning(false);
    setStatusMessage('Training paused. All progress and champion weights preserved.');
    setTimeout(() => setStatusMessage(null), 3500);
  }, []);

  const handleReset = useCallback(() => {
    if (!workerRef.current) return;
    if (window.confirm('Are you sure you want to reset training history and return to baseline weights?')) {
      workerRef.current.postMessage({
        type: 'RESET',
        payload: { weights: DEFAULT_PLANNER_WEIGHTS },
      });
      setIsRunning(false);
      setStatusMessage('Training history cleared. Reset to factory baseline.');
      setTimeout(() => setStatusMessage(null), 3500);
    }
  }, []);

  const handleApply = useCallback(() => {
    onApplyChampion(championWeights);
    setStatusMessage('Champion weights applied to live Awakening Calculator!');
    setTimeout(() => setStatusMessage(null), 4000);
  }, [championWeights, onApplyChampion]);

  const latestPoint = history.length > 0 ? history[history.length - 1] : null;
  const currentGen = latestPoint ? latestPoint.generation : 0;
  const totalGames = latestPoint ? latestPoint.totalGamesPlayed : 0;
  const tapsPerSec = latestPoint ? latestPoint.tapsPerSecond : 0;
  const bestAvgTaps = latestPoint ? latestPoint.allTimeBestTaps : 4800;

  // Check if current active calculator weights match the champion
  const isApplied = JSON.stringify(activeWeights) === JSON.stringify(championWeights);

  const baselineRefTaps = 4800;
  const improvementPct =
    bestAvgTaps < baselineRefTaps
      ? Math.round(((baselineRefTaps - bestAvgTaps) / baselineRefTaps) * 100)
      : 0;

  return (
    <div className="ai-training-lab">
      {/* Top Banner / Hero */}
      <div className="lab-hero">
        <div className="lab-hero-left">
          <div className="lab-badge-row">
            <span className={`status-pill ${isRunning ? 'status-active' : 'status-paused'}`}>
              <span className="status-indicator"></span>
              {isRunning ? 'TRAINING IN PROGRESS' : 'TRAINING IDLE'}
            </span>
            <span className="tech-badge">Web Worker Multi-Threaded</span>
            <span className="tech-badge">Genetic Algorithm</span>
          </div>
          <h2 className="lab-title">Awakening AI Training Lab</h2>
          <p className="lab-desc">
            Simulates thousands of Page 3 games continuously in a background thread to discover the mathematically fastest tap strategies using generational breeding and mutation.
          </p>
        </div>

        <div className="lab-hero-controls">
          {!isRunning ? (
            <button className="btn-lab-primary" onClick={handleStart}>
              ▶ Start Training
            </button>
          ) : (
            <button className="btn-lab-pause" onClick={handlePause}>
              ⏸ Pause Training
            </button>
          )}

          <button
            className={`btn-lab-apply ${isApplied ? 'btn-lab-applied' : ''}`}
            onClick={handleApply}
            title="Inject champion weights into the Calculator tab"
          >
            {isApplied ? '✓ Champion Active' : '⚡ Apply to Calculator'}
          </button>

          <button className="btn-lab-ghost" onClick={handleReset} title="Reset all progress">
            🔄 Reset
          </button>
        </div>
      </div>

      {statusMessage && <div className="status-toast">{statusMessage}</div>}

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Current Generation</div>
          <div className="kpi-val font-mono">
            {currentGen > 0 ? `Gen ${currentGen}` : 'Gen 0'}
          </div>
          <div className="kpi-foot text-muted">20 candidate strategies per gen</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Total Games Simulated</div>
          <div className="kpi-val font-mono text-cyan">
            {totalGames.toLocaleString()}
          </div>
          <div className="kpi-foot text-muted">Page 3 complete playthroughs</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Simulation Speed</div>
          <div className="kpi-val font-mono text-gold">
            {tapsPerSec > 0 ? `${tapsPerSec.toLocaleString()}` : '0'}{' '}
            <span className="kpi-unit">taps/sec</span>
          </div>
          <div className="kpi-foot text-muted">Zero main-thread lag</div>
        </div>

        <div className="kpi-card highlight-card">
          <div className="kpi-label">All-Time Best Average</div>
          <div className="kpi-val font-mono text-gold">
            {bestAvgTaps.toLocaleString()} <span className="kpi-unit">taps</span>
          </div>
          <div className="kpi-foot">
            {improvementPct > 0 ? (
              <span className="improvement-badge">-{improvementPct}% vs Baseline</span>
            ) : (
              <span className="text-muted">Evaluating baseline...</span>
            )}
          </div>
        </div>
      </div>

      {/* Descent Chart Section */}
      <div className="lab-section">
        <div className="section-header">
          <div>
            <h3 className="section-title">Evolutionary Tap Descent Curve</h3>
            <p className="section-subtitle">
              Visualizes average taps required to max Page 3 over time. Watch the learning curve drop from ~4,800 taps down toward the ~1,500 tap theoretical ceiling.
            </p>
          </div>
        </div>
        <TrainingChart data={history} baselineTaps={baselineRefTaps} />
      </div>

      {/* Weights Inspector Section */}
      <div className="lab-section">
        <WeightsInspector
          championWeights={championWeights}
          baselineWeights={DEFAULT_PLANNER_WEIGHTS}
          onApplyToCalculator={handleApply}
          onResetWeights={handleReset}
          isApplied={isApplied}
        />
      </div>
    </div>
  );
};
