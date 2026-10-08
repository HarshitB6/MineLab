// reports/report-generator.js — PDF/Excel/CSV report generation

const ReportGenerator = {

  // ── Build HTML report ─────────────────────────────────────────

  buildHTML(state, sections) {
    const ds = state.dataset;
    const det = state.detection;
    const pre = state.preprocessing;
    const now = Helpers.formatDate();

    let html = `
<div id="report-preview" style="font-family:'Inter',sans-serif;max-width:800px;margin:0 auto;padding:40px;background:#fff;color:#172B3A;font-size:13px;line-height:1.6;">

  <!-- Cover -->
  <div style="text-align:center;padding-bottom:28px;border-bottom:2px solid #173B57;margin-bottom:28px;">
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#168C8C;font-weight:700;margin-bottom:8px;">DATA MINE STUDIO</div>
    <h1 style="font-size:24px;font-weight:800;color:#173B57;margin:0 0 6px">Data Mining Analysis Report</h1>
    <p style="color:#667085;font-size:13px;">Generated: ${now}</p>
    ${ds.loaded ? `<p style="margin-top:6px;color:#172B3A;font-weight:600;">Dataset: ${Helpers.escapeHtml(ds.filename)}</p>` : ''}
  </div>`;

    if (sections.datasetOverview && ds.loaded) {
      html += this._sectionDatasetOverview(ds, state.summary);
    }
    if (sections.attributeDetection && ds.loaded) {
      html += this._sectionAttributeDetection(ds.columns, ds.schema);
    }
    if (sections.dataQuality && ds.loaded) {
      html += this._sectionDataQuality(state.summary);
    }
    if (sections.preprocessing && pre.applied) {
      html += this._sectionPreprocessing(pre);
    }
    if (sections.algorithmConfig) {
      html += this._sectionAlgorithmConfig(state.analysis);
    }
    if (sections.results) {
      html += this._sectionResults(state.analysis);
    }
    if (sections.modelComparison && state.comparison) {
      html += this._sectionModelComparison(state.comparison);
    }
    if (sections.conclusion) {
      html += this._sectionConclusion(ds, state.analysis);
    }

    html += `</div>`;
    return html;
  },

  // ── Section: Dataset Overview ─────────────────────────────────

  _sectionDatasetOverview(ds, summary) {
    return `
<div style="margin-bottom:24px;">
  <h2 style="font-size:15px;font-weight:700;color:#173B57;border-bottom:2px solid #173B57;padding-bottom:6px;margin-bottom:12px;">1. Dataset Overview</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;width:40%">Filename</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${Helpers.escapeHtml(ds.filename)}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Format</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${(ds.fileType || '').toUpperCase()}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Total Rows</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${(ds.rowCount || 0).toLocaleString()}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Total Columns</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${ds.columnCount || 0}</td></tr>
    ${summary ? `<tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Missing Values</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${summary.missingTotal}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Duplicate Rows</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${summary.duplicates}</td></tr>` : ''}
  </table>
</div>`;
  },

  // ── Section: Attribute Detection ──────────────────────────────

  _sectionAttributeDetection(columns, schema) {
    let rows = '';
    (columns || []).forEach(col => {
      const s = schema?.[col] || {};
      rows += `<tr>
        <td style="padding:6px 10px;border:1px solid #E4E7EC;">${Helpers.escapeHtml(col)}</td>
        <td style="padding:6px 10px;border:1px solid #E4E7EC;">${s.detectedType || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #E4E7EC;">${s.role || '—'}</td>
        <td style="padding:6px 10px;border:1px solid #E4E7EC;text-align:right">${s.uniqueCount ?? '—'}</td>
        <td style="padding:6px 10px;border:1px solid #E4E7EC;text-align:right">${s.missingCount ?? '—'}</td>
      </tr>`;
    });
    return `
<div style="margin-bottom:24px;">
  <h2 style="font-size:15px;font-weight:700;color:#173B57;border-bottom:2px solid #173B57;padding-bottom:6px;margin-bottom:12px;">2. Attribute Detection</h2>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr style="background:#F7F9FC;"><th style="padding:8px 10px;border:1px solid #E4E7EC;text-align:left">Column</th><th style="padding:8px 10px;border:1px solid #E4E7EC;text-align:left">Type</th><th style="padding:8px 10px;border:1px solid #E4E7EC;text-align:left">Role</th><th style="padding:8px 10px;border:1px solid #E4E7EC;text-align:right">Unique</th><th style="padding:8px 10px;border:1px solid #E4E7EC;text-align:right">Missing</th></tr>
    ${rows}
  </table>
</div>`;
  },

  // ── Section: Data Quality ─────────────────────────────────────

  _sectionDataQuality(summary) {
    if (!summary) return '';
    const completeness = (summary.completeness * 100).toFixed(1);
    return `
<div style="margin-bottom:24px;">
  <h2 style="font-size:15px;font-weight:700;color:#173B57;border-bottom:2px solid #173B57;padding-bottom:6px;margin-bottom:12px;">3. Data Quality</h2>
  <p>The dataset has a completeness rate of <strong>${completeness}%</strong>.</p>
  <ul style="margin-top:8px;padding-left:20px;">
    <li>Missing Values: ${summary.missingTotal}</li>
    <li>Duplicate Rows: ${summary.duplicates}</li>
    <li>Constant Columns: ${summary.constantCount}</li>
    <li>Numerical Columns: ${summary.numericCount}</li>
    <li>Categorical Columns: ${summary.categoricalCount}</li>
  </ul>
</div>`;
  },

  // ── Section: Preprocessing ────────────────────────────────────

  _sectionPreprocessing(pre) {
    const cfg = pre.config || {};
    const b = pre.beforeStats || {}, a = pre.afterStats || {};
    return `
<div style="margin-bottom:24px;">
  <h2 style="font-size:15px;font-weight:700;color:#173B57;border-bottom:2px solid #173B57;padding-bottom:6px;margin-bottom:12px;">4. Preprocessing</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Missing Value Strategy</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${cfg.missingStrategy}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Encoding</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${cfg.encoding}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Scaling</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${cfg.scaling}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Outlier Method</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${cfg.outlierMethod}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Train/Test Split</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${Math.round((cfg.trainTestSplit || 0.75) * 100)}% / ${100 - Math.round((cfg.trainTestSplit || 0.75) * 100)}%</td></tr>
    ${b.rows !== undefined ? `<tr><td style="padding:6px 10px;border:1px solid #E4E7EC;font-weight:600;background:#F7F9FC;">Rows Before/After</td><td style="padding:6px 10px;border:1px solid #E4E7EC;">${b.rows} → ${a.rows}</td></tr>` : ''}
  </table>
</div>`;
  },

  // ── Section: Algorithm Config ─────────────────────────────────

  _sectionAlgorithmConfig(analysis) {
    const sections = [];
    if (analysis.classification?.result) {
      const c = analysis.classification;
      sections.push(`<li>Task: Classification | Algorithm: ${c.algorithm?.toUpperCase()} | Target: ${c.target} | Features: ${(c.features || []).join(', ')}</li>`);
    }
    if (analysis.regression?.result) {
      const r = analysis.regression;
      sections.push(`<li>Task: Regression | Algorithm: ${r.algorithm === 'simple' ? 'Simple Linear Regression' : 'Multiple Linear Regression'} | Target: ${r.target}</li>`);
    }
    if (analysis.clustering?.result) {
      const k = analysis.clustering;
      sections.push(`<li>Task: Clustering | Algorithm: K-Means | K=${k.k}</li>`);
    }
    if (analysis.association?.result) {
      const a = analysis.association;
      sections.push(`<li>Task: Association Rules | Algorithm: ${a.algorithm?.toUpperCase()} | Min Support: ${a.parameters?.minSupport}</li>`);
    }
    if (!sections.length) return '';
    return `
<div style="margin-bottom:24px;">
  <h2 style="font-size:15px;font-weight:700;color:#173B57;border-bottom:2px solid #173B57;padding-bottom:6px;margin-bottom:12px;">5. Algorithm Configuration</h2>
  <ul style="padding-left:20px;">${sections.join('')}</ul>
</div>`;
  },

  // ── Section: Results ──────────────────────────────────────────

  _sectionResults(analysis) {
    let content = '';

    if (analysis.classification?.result) {
      const r = analysis.classification.result;
      content += `<h3 style="font-size:13px;font-weight:700;margin:12px 0 6px">Classification Results</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;">
        <tr style="background:#F7F9FC;"><th style="padding:8px 10px;border:1px solid #E4E7EC">Metric</th><th style="padding:8px 10px;border:1px solid #E4E7EC">Value</th></tr>
        <tr><td style="padding:6px 10px;border:1px solid #E4E7EC">Accuracy</td><td style="padding:6px 10px;border:1px solid #E4E7EC">${(r.accuracy * 100).toFixed(2)}%</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #E4E7EC">Precision</td><td style="padding:6px 10px;border:1px solid #E4E7EC">${(r.precision * 100).toFixed(2)}%</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #E4E7EC">Recall</td><td style="padding:6px 10px;border:1px solid #E4E7EC">${(r.recall * 100).toFixed(2)}%</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #E4E7EC">F1 Score</td><td style="padding:6px 10px;border:1px solid #E4E7EC">${(r.f1 * 100).toFixed(2)}%</td></tr>
      </table>`;
    }

    if (analysis.regression?.result) {
      const r = analysis.regression.result;
      content += `<h3 style="font-size:13px;font-weight:700;margin:12px 0 6px">Regression Results</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;">
        <tr style="background:#F7F9FC;"><th style="padding:8px 10px;border:1px solid #E4E7EC">Metric</th><th style="padding:8px 10px;border:1px solid #E4E7EC">Value</th></tr>
        <tr><td style="padding:6px 10px;border:1px solid #E4E7EC">MAE</td><td style="padding:6px 10px;border:1px solid #E4E7EC">${r.mae.toFixed(4)}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #E4E7EC">MSE</td><td style="padding:6px 10px;border:1px solid #E4E7EC">${r.mse.toFixed(4)}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #E4E7EC">RMSE</td><td style="padding:6px 10px;border:1px solid #E4E7EC">${r.rmse.toFixed(4)}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #E4E7EC">R² Score</td><td style="padding:6px 10px;border:1px solid #E4E7EC">${r.r2.toFixed(4)}</td></tr>
      </table>`;
    }

    if (analysis.clustering?.result) {
      const r = analysis.clustering.result;
      content += `<h3 style="font-size:13px;font-weight:700;margin:12px 0 6px">Clustering Results (K-Means)</h3>
      <p>Clusters: ${r.k} | Silhouette Score: ${r.silhouette?.toFixed(4)}</p>`;
    }

    if (analysis.association?.result) {
      const r = analysis.association.result;
      content += `<h3 style="font-size:13px;font-weight:700;margin:12px 0 6px">Association Rules Results</h3>
      <p>Frequent Itemsets: ${r.itemsetCount} | Rules Generated: ${r.ruleCount}</p>`;
    }

    if (!content) return '';
    return `<div style="margin-bottom:24px;"><h2 style="font-size:15px;font-weight:700;color:#173B57;border-bottom:2px solid #173B57;padding-bottom:6px;margin-bottom:12px;">6. Results</h2>${content}</div>`;
  },

  // ── Section: Model Comparison ─────────────────────────────────

  _sectionModelComparison(comparison) {
    if (comparison && (comparison.classification?.length || comparison.regression?.length)) {
      const table = (title, rows, headers) => {
        if (!rows?.length) return '';
        return `<h3 style="font-size:13px;font-weight:700;margin:12px 0 6px">${title}</h3><table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:18px"><tr style="background:#F7F9FC">${headers.map(h => `<th style="padding:7px;border:1px solid #E4E7EC;text-align:left">${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${headers.map(h => `<td style="padding:7px;border:1px solid #E4E7EC">${r[h] ?? ''}</td>`).join('')}</tr>`).join('')}</table>`;
      };
      const clf = comparison.classification || [], reg = comparison.regression || [];
      const clfGraph = this._comparisonChart('Classification metrics (%)', clf, 'Algorithm', [
        {key:'Accuracy',label:'Accuracy'}, {key:'Precision',label:'Precision'}, {key:'Recall',label:'Recall'}, {key:'F1 Score',label:'F1 Score'}
      ]);
      const regGraph = this._comparisonChart('Regression metric view', reg, 'Model', [
        {key:'RMSE',label:'RMSE'}, {key:'R²',label:'R²'}
      ]);
      return `<div style="margin-bottom:24px"><h2 style="font-size:15px;font-weight:700;color:#173B57;border-bottom:2px solid #173B57;padding-bottom:6px;margin-bottom:12px">7. Model Comparison</h2>
        ${clf.length ? `<h3 style="font-size:13px;font-weight:700">Classification</h3>${clfGraph}${table('Classification benchmark results', clf, ['Algorithm','Accuracy','Precision','Recall','F1 Score','Training Time'])}` : ''}
        ${reg.length ? `<h3 style="font-size:13px;font-weight:700">Regression</h3>${regGraph}${table('Regression benchmark results', reg, ['Model','MAE','MSE','RMSE','R²','Training Time'])}` : ''}
      </div>`;
    }
    if (!comparison || !comparison.rows?.length) return '';
    const headers = Object.keys(comparison.rows[0]);
    let rows = comparison.rows.map(r =>
      '<tr>' + headers.map(h => `<td style="padding:6px 10px;border:1px solid #E4E7EC;">${r[h]}</td>`).join('') + '</tr>'
    ).join('');
    return `
<div style="margin-bottom:24px;">
  <h2 style="font-size:15px;font-weight:700;color:#173B57;border-bottom:2px solid #173B57;padding-bottom:6px;margin-bottom:12px;">7. Model Comparison</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tr style="background:#F7F9FC;">${headers.map(h => `<th style="padding:8px 10px;border:1px solid #E4E7EC">${h}</th>`).join('')}</tr>
    ${rows}
  </table>
</div>`;
  },

  _comparisonChart(title, rows, categoryKey, series) {
    if (!rows?.length) return '';
    const width = 720, height = 250, left = 42, right = 12, top = 34, bottom = 58;
    const plotW = width - left - right, plotH = height - top - bottom;
    const values = rows.flatMap(row => series.map(s => parseFloat(row[s.key]) || 0));
    const min = Math.min(0, ...values), max = Math.max(0, ...values);
    const range = Math.max(max - min, 1);
    const groupW = plotW / rows.length, barW = Math.min(34, groupW / (series.length + 1));
    const colors = ['#168C8C', '#315B78', '#E5A42F', '#4B9676'];
    let marks = `<text x="${width / 2}" y="20" text-anchor="middle" font-size="16" font-weight="700" fill="#203746">${title}</text>`;
    for (let i = 0; i <= 4; i++) {
      const y = top + plotH * i / 4;
      const value = max - range * i / 4;
      marks += `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" stroke="#E8EDF2"/><text x="${left-7}" y="${y+4}" text-anchor="end" font-size="10" fill="#667085">${value.toFixed(1)}</text>`;
    }
    rows.forEach((row, i) => {
      const center = left + groupW * (i + .5);
      series.forEach((s, j) => {
        const value = parseFloat(row[s.key]) || 0;
        const zeroY = top + (max / range) * plotH;
        const barY = top + ((max - value) / range) * plotH;
        const y = Math.min(zeroY, barY);
        const barH = Math.max(1, Math.abs(zeroY - barY));
        const x = center + (j - (series.length - 1) / 2) * (barW + 3) - barW / 2;
        marks += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${colors[j % colors.length]}" opacity=".88"/>`;
      });
      const label = String(row[categoryKey] || '').replace(/[&<>"']/g, ' ');
      marks += `<text x="${center}" y="${top+plotH+18}" text-anchor="middle" font-size="10" fill="#667085">${label.slice(0, 25)}</text>`;
    });
    const legendWidth = series.length * 125;
    series.forEach((s, i) => {
      const x = (width - legendWidth) / 2 + i * 125;
      marks += `<rect x="${x}" y="${height-17}" width="10" height="10" rx="5" fill="${colors[i % colors.length]}"/><text x="${x+15}" y="${height-8}" font-size="10" fill="#667085">${s.label}</text>`;
    });
    return `<div style="margin:14px 0 20px;page-break-inside:avoid"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;background:#fff">${marks}</svg></div>`;
  },

  // ── Section: Conclusion ───────────────────────────────────────

  _sectionConclusion(ds, analysis) {
    const tasks = [];
    if (analysis.classification?.result) tasks.push('Classification');
    if (analysis.regression?.result) tasks.push('Regression');
    if (analysis.clustering?.result) tasks.push('Clustering');
    if (analysis.association?.result) tasks.push('Association Rules');
    return `
<div style="margin-bottom:24px;">
  <h2 style="font-size:15px;font-weight:700;color:#173B57;border-bottom:2px solid #173B57;padding-bottom:6px;margin-bottom:12px;">8. Conclusion</h2>
  <p>This report was generated using MineLab — DWM Analytics Workspace.</p>
  ${ds.loaded ? `<p style="margin-top:8px;">The dataset <strong>${Helpers.escapeHtml(ds.filename)}</strong> was analyzed with ${tasks.length > 0 ? tasks.join(', ') : 'no completed'} task(s).</p>` : ''}
  <p style="margin-top:8px;color:#667085;font-size:11px;">All analysis was performed client-side. Please validate results with domain expertise before drawing conclusions.</p>
</div>`;
  }
};;
