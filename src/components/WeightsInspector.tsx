import React from 'react';
import {
  type PlannerWeights,
  DEFAULT_PLANNER_WEIGHTS,
} from '../weights.ts';

interface WeightsInspectorProps {
  championWeights: PlannerWeights;
  baselineWeights?: PlannerWeights;
  onApplyToCalculator?: () => void;
  onResetWeights?: () => void;
  isApplied?: boolean;
}

interface ParameterMeta {
  key: keyof PlannerWeights;
  label: string;
  description: string;
  category: 'bottleneck' | 'preservation' | 'rarity' | 'general';
}

const PARAMETER_METADATA: ParameterMeta[] = [
  {
    key: 'bottleneckPenaltyPerStar',
    label: 'Bottleneck Avoidance Penalty',
    description: 'Punishes rerolling acceptable nodes when 1★–3★ bottlenecks still exist',
    category: 'bottleneck',
  },
  {
    key: 'bottleneckReward',
    label: 'Bottleneck Targeting Bonus',
    description: 'Incentivizes moves that directly target and repair the board’s lowest star cell',
    category: 'bottleneck',
  },
  {
    key: 'outsideDeficitWeight',
    label: 'Outside Deficit Barrier',
    description: 'Cost multiplier for shortfall stars when un-touched cells make winning impossible',
    category: 'bottleneck',
  },
  {
    key: 'outsideDeficitThreshold',
    label: 'Outside Deficit Threshold',
    description: 'Remaining deficit window where outside bottleneck barriers activate',
    category: 'bottleneck',
  },
  {
    key: 'valueDeltaWeight',
    label: 'Star Quality Preservation',
    description: 'Multiplier to prevent destroying existing 5★/6★ cells for low expected gains',
    category: 'preservation',
  },
  {
    key: 'sixStarPreservationPenalty',
    label: '6★ Collateral Destruction Penalty',
    description: 'Heavy penalty for rerolling moves that destroy existing 6★ cells',
    category: 'preservation',
  },
  {
    key: 'fiveStarUpgradeReward',
    label: '5★ Cluster Upgrade Bonus',
    description: 'Incentive to target clusters with high 5★ counts during endgame polish',
    category: 'preservation',
  },
  {
    key: 'sixStarDiscount',
    label: '6★ Lock Discount',
    description: 'Cost credit awarded for leaving maxed-out 6★ nodes untouched',
    category: 'preservation',
  },
  {
    key: 'expStarDeltaWeight',
    label: 'Net Star Delta Multiplier',
    description: 'Weight for immediate expected star count improvement',
    category: 'general',
  },
  {
    key: 'cellDeficitMultiplier',
    label: 'Cell Deficit Multiplier',
    description: 'General cost-to-go penalty per star missing below per-node targets',
    category: 'general',
  },
  {
    key: 'starValue6',
    label: '6★ Relative Rarity',
    description: 'Difficulty score for rolling a 6★ (1 in 33.3 rolls, 3%)',
    category: 'rarity',
  },
  {
    key: 'starValue5',
    label: '5★ Relative Rarity',
    description: 'Difficulty score for rolling a 5★ (1 in 11.1 rolls, 9%)',
    category: 'rarity',
  },
  {
    key: 'starValue4',
    label: '4★ Relative Rarity',
    description: 'Difficulty score for rolling a 4★ (1 in 10 rolls, 10%)',
    category: 'rarity',
  },
];

export const WeightsInspector: React.FC<WeightsInspectorProps> = ({
  championWeights,
  baselineWeights = DEFAULT_PLANNER_WEIGHTS,
  onApplyToCalculator,
  onResetWeights,
  isApplied = false,
}) => {
  const exportWeightsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(championWeights, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `awakening_ai_weights_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="weights-inspector-card">
      <div className="weights-inspector-header">
        <div>
          <h3 className="section-title">Evolved Champion DNA (Parameter Matrix)</h3>
          <p className="section-subtitle">
            Compare the hand-crafted baseline with the AI’s evolved weights to inspect what strategic adjustments improved its tap efficiency.
          </p>
        </div>
        <div className="weights-actions">
          {onApplyToCalculator && (
            <button
              className={`btn-action ${isApplied ? 'btn-applied' : 'btn-primary'}`}
              onClick={onApplyToCalculator}
              title="Apply these weights to the live Awakening Board Calculator"
            >
              {isApplied ? '✓ Champion Applied' : '⚡ Apply to Calculator'}
            </button>
          )}
          <button
            className="btn-action btn-secondary"
            onClick={exportWeightsJson}
            title="Export weights to a JSON file"
          >
            💾 Export JSON
          </button>
          {onResetWeights && (
            <button
              className="btn-action btn-ghost"
              onClick={onResetWeights}
              title="Reset weights back to factory defaults"
            >
              🔄 Reset to Defaults
            </button>
          )}
        </div>
      </div>

      <div className="weights-table-container">
        <table className="weights-table">
          <thead>
            <tr>
              <th>Parameter / Heuristic</th>
              <th>Baseline</th>
              <th>Evolved Champion</th>
              <th>Change (%)</th>
              <th>Strategic Impact</th>
            </tr>
          </thead>
          <tbody>
            {PARAMETER_METADATA.map((meta) => {
              const baseVal = baselineWeights[meta.key] ?? DEFAULT_PLANNER_WEIGHTS[meta.key] ?? 0;
              const champVal = championWeights[meta.key] ?? baseVal;
              const deltaPct = baseVal !== 0 ? ((champVal - baseVal) / baseVal) * 100 : 0;
              const deltaFormatted = deltaPct > 0 ? `+${deltaPct.toFixed(1)}%` : `${deltaPct.toFixed(1)}%`;

              let badgeClass = 'badge-neutral';
              if (Math.abs(deltaPct) >= 5) {
                badgeClass = deltaPct > 0 ? 'badge-positive' : 'badge-negative';
              }

              return (
                <tr key={meta.key}>
                  <td className="param-name-cell">
                    <span className="param-label">{meta.label}</span>
                    <code className="param-key">{meta.key}</code>
                  </td>
                  <td className="param-val-cell font-mono">{baseVal.toFixed(2)}</td>
                  <td className="param-val-cell font-mono champ-val">
                    <strong>{champVal.toFixed(2)}</strong>
                  </td>
                  <td>
                    <span className={`delta-badge ${badgeClass}`}>
                      {deltaFormatted}
                    </span>
                  </td>
                  <td className="param-desc-cell">{meta.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
