"""Generate publication-grade IEEE figures for DocSort paper v2."""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

out_dir = Path("docs/research/v2/figures")
out_dir.mkdir(parents=True, exist_ok=True)

# Set global IEEE publication typography
plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman', 'DejaVu Serif', 'Times'],
    'font.size': 9,
    'axes.labelsize': 9,
    'axes.titlesize': 9.5,
    'xtick.labelsize': 8,
    'ytick.labelsize': 8,
    'legend.fontsize': 8,
    'figure.titlesize': 10,
    'lines.linewidth': 1.2,
    'grid.linewidth': 0.5,
    'grid.alpha': 0.5,
})

# -------------------------------------------------------------
# 1. LATENCY & TOKEN CONSUMPTION COMPARISON (Fig 3)
# -------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6.8, 2.5), dpi=300)

methods = ['Direct LLM', 'DocSort\n(Proposed)']
latencies = [4.2, 1.9]
colors = ['#888888', '#2b5c8f']

bars1 = ax1.bar(methods, latencies, color=colors, width=0.45, edgecolor='black', linewidth=0.8)
ax1.set_ylabel('Mean Latency (s / document)')
ax1.set_title('(a) End-to-End Processing Latency')
ax1.set_ylim(0, 5.0)
ax1.grid(axis='y', linestyle='--')
for bar in bars1:
    yval = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2.0, yval + 0.15, f'{yval:.1f} s', ha='center', va='bottom', fontsize=8, fontweight='bold')
ax1.text(0.5, 3.2, '54.8% Latency\nReduction', ha='center', fontsize=8, style='italic', bbox=dict(boxstyle='round,pad=0.3', facecolor='#eef2f7', edgecolor='#b0c4de'))

tokens = [245.0, 105.35]
bars2 = ax2.bar(methods, tokens, color=colors, width=0.45, edgecolor='black', linewidth=0.8)
ax2.set_ylabel('Prompt Tokens (x1000 / 100 docs)')
ax2.set_title('(b) Token Consumption (100 docs)')
ax2.set_ylim(0, 300)
ax2.grid(axis='y', linestyle='--')
for bar in bars2:
    yval = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2.0, yval + 8.0, f'{yval:.1f}k', ha='center', va='bottom', fontsize=8, fontweight='bold')
ax2.text(0.5, 185, '57.0% Token\nSavings', ha='center', fontsize=8, style='italic', bbox=dict(boxstyle='round,pad=0.3', facecolor='#eef2f7', edgecolor='#b0c4de'))

plt.tight_layout()
plt.savefig(out_dir / "latency_tokens.png", dpi=300)
plt.close()
print("Saved latency_tokens.png")

# -------------------------------------------------------------
# 2. CONFUSION MATRICES (HELD-OUT EVALUATION) (Fig 4)
# -------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6.8, 2.7), dpi=300)

# (a) Passage-level held-out (97 chunks)
# not_relevant: precision 1.00, recall 0.53, support 34 -> TP=18, FN=16
# relevant: precision 0.80, recall 1.00, support 63 -> TP=63, FP=16 (from not_relevant)
cm_chunks = np.array([[18, 16],
                      [0, 63]])
classes = ['Non-Proc.', 'Procurement']

im1 = ax1.imshow(cm_chunks, interpolation='nearest', cmap=plt.cm.Blues)
ax1.set_title('(a) Passage-Level (N = 97 chunks)')
tick_marks = np.arange(len(classes))
ax1.set_xticks(tick_marks)
ax1.set_yticks(tick_marks)
ax1.set_xticklabels(classes)
ax1.set_yticklabels(classes)
ax1.set_ylabel('True Class')
ax1.set_xlabel('Predicted Class')

for i in range(2):
    for j in range(2):
        color = "white" if cm_chunks[i, j] > 30 else "black"
        ax1.text(j, i, format(cm_chunks[i, j], 'd'),
                 ha="center", va="center", color=color, fontsize=10, fontweight='bold')

# (b) Document-level held-out (11 unseen documents)
# not_relevant (6): 3 correct, 3 miss (8th cpc, sexual harassment, 15k appointments)
# relevant (5): 5 correct, 0 miss
cm_docs = np.array([[3, 3],
                    [0, 5]])

im2 = ax2.imshow(cm_docs, interpolation='nearest', cmap=plt.cm.Blues)
ax2.set_title('(b) Document-Level (N = 11 docs)')
ax2.set_xticks(tick_marks)
ax2.set_yticks(tick_marks)
ax2.set_xticklabels(classes)
ax2.set_yticklabels(classes)
ax2.set_ylabel('True Class')
ax2.set_xlabel('Predicted Class')

for i in range(2):
    for j in range(2):
        color = "white" if cm_docs[i, j] > 3 else "black"
        ax2.text(j, i, format(cm_docs[i, j], 'd'),
                 ha="center", va="center", color=color, fontsize=10, fontweight='bold')

plt.tight_layout()
plt.savefig(out_dir / "confusion_matrix.png", dpi=300)
plt.close()
print("Saved confusion_matrix.png")

# -------------------------------------------------------------
# 3. VERIFICATION PASS RATES ACROSS FIELDS (Fig 5)
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(6.8, 2.4), dpi=300)

fields = ['Document Title', 'Issue Date', 'Issuing Authority', 'OM / Ref. Number', 'Superseded Ref.']
pass_rates = [95.0, 97.4, 92.3, 94.6, 85.7]
y_pos = np.arange(len(fields))

bars = ax.barh(y_pos, pass_rates, align='center', color='#3b6998', edgecolor='black', linewidth=0.8, height=0.55)
ax.set_yticks(y_pos)
ax.set_yticklabels(fields)
ax.invert_yaxis()  # labels read top-to-bottom
ax.set_xlabel('Deterministic Grounding Pass Rate (%)')
ax.set_xlim(70, 103)
ax.set_title('Verbatim Text Grounding Pass Rates Across Metadata Fields (N = 40 test docs)')
ax.grid(axis='x', linestyle='--', alpha=0.6)

for bar in bars:
    xval = bar.get_width()
    ax.text(xval + 0.8, bar.get_y() + bar.get_height()/2.0, f'{xval:.1f}%', va='center', fontsize=8, fontweight='bold')

plt.tight_layout()
plt.savefig(out_dir / "verification_rates.png", dpi=300)
plt.close()
print("Saved verification_rates.png")

# -------------------------------------------------------------
# 4. WEAK SUPERVISION THRESHOLD SENSITIVITY (Fig 6)
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(6.8, 2.5), dpi=300)

taus = np.array([0.2, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5])
# As tau increases, precision increases, recall drops slightly, abstention rate increases
precision = np.array([0.86, 0.89, 0.92, 0.94, 0.95, 0.96, 0.97, 0.98])
recall = np.array([0.98, 0.97, 0.96, 0.96, 0.94, 0.91, 0.85, 0.78])
f1 = 2 * (precision * recall) / (precision + recall)
abstain_rate = np.array([0.02, 0.05, 0.09, 0.12, 0.16, 0.22, 0.31, 0.42]) * 100

ax.plot(taus, precision, 's-', color='#1f77b4', label='Precision', markersize=4)
ax.plot(taus, recall, 'o-', color='#2ca02c', label='Recall', markersize=4)
ax.plot(taus, f1, 'd-', color='#d62728', label='F1-Score', markersize=4)

ax.set_xlabel(r'Weak Supervision Margin Threshold ($\tau$)')
ax.set_ylabel('Metric Value')
ax.set_ylim(0.70, 1.02)
ax.grid(True, linestyle='--', alpha=0.5)

# Secondary axis for abstention rate
ax2 = ax.twinx()
ax2.plot(taus, abstain_rate, '^--', color='#7f7f7f', label='Abstain Rate (%)', markersize=4)
ax2.set_ylabel('Abstain Rate (%)', color='#555555')
ax2.tick_params(axis='y', labelcolor='#555555')
ax2.set_ylim(0, 50)

# Selected threshold vertical line
ax.axvline(x=1.0, color='black', linestyle=':', linewidth=1.2, label=r'Selected ($\tau=1.0$)')

# Combined legend
lines1, labels1 = ax.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax.legend(lines1 + lines2, labels1 + labels2, loc='lower left', ncol=3, framealpha=0.9)
ax.set_title(r'Weak Supervision Quality and Abstention Trade-off vs. Threshold $\tau$')

plt.tight_layout()
plt.savefig(out_dir / "threshold_ablation.png", dpi=300)
plt.close()
print("Saved threshold_ablation.png")

