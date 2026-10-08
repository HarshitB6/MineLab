// core/preprocessing.js — Data preprocessing engine

const Preprocessing = {

  // ── Apply full pipeline ──────────────────────────────────────

  apply(rows, columns, schema, config) {
    let data = rows.map(r => ({ ...r }));
    const log = [];
    const processingColumns = [...columns];

    // Columns that must never be transformed like ordinary features.
    // Targets are protected from encoding/scaling/outlier filtering so the
    // classification/regression label keeps its original meaning.
    const protectedColumns = new Set(config.protectedColumns || []);

    // 1. Remove duplicate rows
    if (config.removeDuplicates) {
      const before = data.length;
      data = Statistics.removeDuplicates(data, columns);
      log.push(`Removed ${before - data.length} duplicate rows.`);
    }

    // 2. Handle missing values only on non-protected columns
    const transformColumns = columns.filter(c => !protectedColumns.has(c));
    // Keep an explicit flag before imputation. This lets models distinguish a
    // genuine zero from a missing value that is filled with a summary statistic.
    for (const col of transformColumns) {
      if (!data.some(row => row[col] === null || row[col] === undefined || row[col] === '')) continue;
      let indicator = `${col}__was_missing`;
      while (processingColumns.includes(indicator)) indicator += '_';
      data = data.map(row => ({
        ...row,
        [indicator]: row[col] === null || row[col] === undefined || row[col] === '' ? 1 : 0
      }));
      processingColumns.push(indicator);
    }
    const missingStrategy = config.missingStrategy || 'mean';
    data = this._handleMissing(data, transformColumns, schema, missingStrategy);
    log.push(`Applied "${missingStrategy}" strategy for missing feature values.`);
    if (processingColumns.length > columns.length) {
      log.push(`Added ${processingColumns.length - columns.length} missing-value indicator column(s).`);
    }

    // 3. Remove ignored / identifier / date columns from the modeling dataset.
    const ignoreColumns = new Set(config.ignoreColumns || []);
    for (const c of processingColumns) {
      const role = config.roles?.[c] || schema[c]?.role;
      if (role === 'identifier' || role === 'date' || role === 'ignore') ignoreColumns.add(c);
    }
    const keepColumns = processingColumns.filter(c => !ignoreColumns.has(c));

    // 4. Outlier removal on numeric FEATURE columns only. Targets are protected.
    if (config.outlierMethod && config.outlierMethod !== 'none') {
      const before = data.length;
      const numericCols = keepColumns.filter(c =>
        !protectedColumns.has(c) && schema[c] &&
        (schema[c].detectedType === 'integer' || schema[c].detectedType === 'float')
      );
      data = this._removeOutliers(data, numericCols, config.outlierMethod);
      log.push(`Removed ${before - data.length} outlier rows using ${config.outlierMethod}.`);
    }

    // 5. Encode categorical FEATURE columns only. Never encode targets.
    const encodingMap = {};
    if (config.encoding && config.encoding !== 'none') {
      const catCols = keepColumns.filter(c =>
        !protectedColumns.has(c) && schema[c] &&
        (schema[c].detectedType === 'categorical' || schema[c].detectedType === 'boolean' || schema[c].detectedType === 'string')
      );
      if (config.encoding === 'label') {
        const { encoded, maps } = this._labelEncode(data, catCols);
        data = encoded; Object.assign(encodingMap, maps);
        log.push(`Label-encoded ${catCols.length} categorical feature column(s).`);
      } else if (config.encoding === 'onehot') {
        const { encoded, newCols } = this._oneHotEncode(data, catCols, schema);
        data = encoded;
        log.push(`One-hot-encoded ${catCols.length} categorical feature column(s) → ${newCols.length} new columns.`);
        const expanded = keepColumns.filter(c => !catCols.includes(c));
        keepColumns.length = 0; keepColumns.push(...expanded, ...newCols);
      }
    }

    // 6. Scale numeric FEATURE columns only. Targets remain untouched.
    if (config.scaling && config.scaling !== 'none') {
      const scaleCols = keepColumns.filter(c => {
        if (protectedColumns.has(c)) return false;
        const vals = data.map(r => +r[c]).filter(v => !isNaN(v));
        return vals.length > 0;
      });
      if (config.scaling === 'standard') {
        data = this._standardize(data, scaleCols);
        log.push(`Standardized ${scaleCols.length} numerical feature column(s).`);
      } else if (config.scaling === 'minmax') {
        data = this._minMaxScale(data, scaleCols);
        log.push(`Min-Max scaled ${scaleCols.length} numerical feature column(s).`);
      }
    }

    return { data, columns: [...new Set(keepColumns)], log, encodingMap };
  },

  // ── Missing value handling ────────────────────────────────────

  _handleMissing(rows, columns, schema, strategy) {
    if (strategy === 'remove') {
      return rows.filter(r => columns.every(c => r[c] !== null && r[c] !== undefined && r[c] !== ''));
    }

    // Compute fill values
    const fill = {};
    for (const col of columns) {
      const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
      const type = schema[col]?.detectedType;
      if (type === 'integer' || type === 'float') {
        const numVals = vals.map(Number).filter(v => !isNaN(v));
        if (strategy === 'mean') fill[col] = Helpers.mean(numVals);
        else if (strategy === 'median') fill[col] = Helpers.median(numVals);
        else fill[col] = Helpers.mode(vals);
      } else {
        fill[col] = Helpers.mode(vals);
      }
    }

    return rows.map(r => {
      const row = { ...r };
      for (const col of columns) {
        if (row[col] === null || row[col] === undefined || row[col] === '') {
          row[col] = fill[col] !== null && fill[col] !== undefined ? fill[col] : 0;
        }
      }
      return row;
    });
  },

  // ── Outlier removal ───────────────────────────────────────────

  _removeOutliers(rows, numericCols, method) {
    if (!numericCols.length) return rows;

    const bounds = {};
    for (const col of numericCols) {
      const vals = rows.map(r => +r[col]).filter(v => !isNaN(v)).sort((a, b) => a - b);
      if (method === 'iqr') {
        const q1 = vals[Math.floor(vals.length * 0.25)];
        const q3 = vals[Math.floor(vals.length * 0.75)];
        const iqr = q3 - q1;
        bounds[col] = { lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr };
      } else if (method === 'zscore') {
        const m = Helpers.mean(vals);
        const s = Helpers.std(vals) || 1;
        bounds[col] = { lo: m - 3 * s, hi: m + 3 * s };
      }
    }

    return rows.filter(r =>
      numericCols.every(col => {
        const v = +r[col];
        if (isNaN(v)) return true; // keep missing
        return v >= bounds[col].lo && v <= bounds[col].hi;
      })
    );
  },

  // ── Label Encoding ────────────────────────────────────────────

  _labelEncode(rows, catCols) {
    const maps = {};
    for (const col of catCols) {
      const unique = [...new Set(rows.map(r => String(r[col] ?? '').trim()))].sort();
      maps[col] = {};
      unique.forEach((v, i) => { maps[col][v] = i; });
    }
    const encoded = rows.map(r => {
      const row = { ...r };
      for (const col of catCols) {
        const key = String(row[col] ?? '').trim();
        row[col] = maps[col][key] !== undefined ? maps[col][key] : 0;
      }
      return row;
    });
    return { encoded, maps };
  },

  // ── One-Hot Encoding ──────────────────────────────────────────

  _oneHotEncode(rows, catCols, schema) {
    const newCols = [];
    const valueMap = {};
    for (const col of catCols) {
      const maxUnique = 20; // cap to avoid explosion
      const unique = [...new Set(rows.map(r => String(r[col] ?? '').trim()))].slice(0, maxUnique);
      valueMap[col] = unique;
      unique.forEach(v => { const name = `${col}_${v}`; newCols.push(name); });
    }

    const encoded = rows.map(r => {
      const row = { ...r };
      for (const col of catCols) {
        const val = String(row[col] ?? '').trim();
        for (const v of valueMap[col]) {
          row[`${col}_${v}`] = val === v ? 1 : 0;
        }
        delete row[col];
      }
      return row;
    });
    return { encoded, newCols };
  },

  // ── Standardization (Z-score) ─────────────────────────────────

  _standardize(rows, numericCols) {
    const params = {};
    for (const col of numericCols) {
      const vals = rows.map(r => +r[col]).filter(v => !isNaN(v));
      params[col] = { mean: Helpers.mean(vals), std: Helpers.std(vals) || 1 };
    }
    return rows.map(r => {
      const row = { ...r };
      for (const col of numericCols) {
        const v = +row[col];
        if (!isNaN(v)) row[col] = (v - params[col].mean) / params[col].std;
      }
      return row;
    });
  },

  // ── Min-Max Normalization ─────────────────────────────────────

  _minMaxScale(rows, numericCols) {
    const params = {};
    for (const col of numericCols) {
      const vals = rows.map(r => +r[col]).filter(v => !isNaN(v));
      params[col] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return rows.map(r => {
      const row = { ...r };
      for (const col of numericCols) {
        const v = +row[col];
        const { min, max } = params[col];
        if (!isNaN(v)) row[col] = max > min ? (v - min) / (max - min) : 0;
      }
      return row;
    });
  },

  // ── Feature extraction ────────────────────────────────────────

  // Build model-ready matrices without silently turning categorical values into 0.
  // The mapping is learned from the training set and reused for the test set.
  // If preprocessing has already produced numeric columns (label encoding / one-hot),
  // those numeric values are kept as-is.
  prepareClassificationMatrices(train, test, features, target, schema, options = {}) {
    const forceRawCategoricalEncoding = !!options.forceRawCategoricalEncoding;
    const Xtrain = train.map(() => []);
    const Xtest = test.map(() => []);
    const modelFeatures = [];
    const modelFeatureTypes = [];

    for (const f of features) {
      const type = schema?.[f]?.detectedType;
      const trainVals = train.map(r => r[f]);
      const testVals = test.map(r => r[f]);
      const numericTrain = trainVals.filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)));

      // Raw categorical/string/boolean columns need an explicit representation.
      // This avoids the old behaviour where "Male"/"Female"/"Gold" all became 0.
      const isCategorical = type === 'categorical' || type === 'boolean' || type === 'string';
      const shouldOneHot = isCategorical && (
        forceRawCategoricalEncoding ||
        options.encoding === 'none' ||
        options.encoding === undefined
      );

      if (shouldOneHot) {
        const categories = [...new Set(trainVals
          .filter(v => v !== null && v !== undefined && v !== '')
          .map(v => String(v).trim()))].sort();

        // Keep model size bounded for unexpected high-cardinality text.
        const capped = categories.slice(0, 30);
        capped.forEach(cat => {
          const name = `${f}_${cat}`;
          modelFeatures.push(name);
          modelFeatureTypes.push('categorical');
          const ti = capped.indexOf(cat);
          train.forEach((r, i) => {
            Xtrain[i].push(String(r[f] ?? '').trim() === cat ? 1 : 0);
          });
          test.forEach((r, i) => {
            Xtest[i].push(String(r[f] ?? '').trim() === cat ? 1 : 0);
          });
        });
      } else {
        modelFeatures.push(f);
        modelFeatureTypes.push(isCategorical ? 'categorical' : 'numeric');
        train.forEach((r, i) => {
          const n = Number(r[f]);
          Xtrain[i].push(Number.isFinite(n) ? n : 0);
        });
        test.forEach((r, i) => {
          const n = Number(r[f]);
          Xtest[i].push(Number.isFinite(n) ? n : 0);
        });
      }
    }

    return {
      Xtrain,
      Xtest,
      ytrain: train.map(r => r[target]),
      ytest: test.map(r => r[target]),
      modelFeatures,
      featureTypes: modelFeatureTypes
    };
  },

  extractXY(rows, features, target) {
    const X = rows.map(r => features.map(f => {
      const n = Number(r[f]);
      return Number.isFinite(n) ? n : 0;
    }));
    const y = rows.map(r => r[target]);
    return { X, y };
  },

  encodeLabels(y) {
    const classes = [...new Set(y.filter(v => v !== null && v !== undefined))].sort();
    const map = {}, revMap = {};
    classes.forEach((c, i) => { map[c] = i; revMap[i] = c; });
    return { yEncoded: y.map(v => map[String(v)] ?? 0), classes, map, revMap };
  }
};
