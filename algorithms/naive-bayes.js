// algorithms/naive-bayes.js — Gaussian / categorical Naive Bayes
//
// API used by the classification page:
//   model.train(X, y, { smoothing, featureTypes })
//   model.predict(X)

const NaiveBayes = {
  train(X, y, params = {}) {
    if (!Array.isArray(X) || !Array.isArray(y) || X.length !== y.length || !X.length) {
      throw new Error('Naive Bayes needs non-empty feature rows and matching labels.');
    }

    this._classes = [...new Set(y.map(String))].sort();
    this._smoothing = Math.max(0, Number(params.smoothing ?? 1));
    this._featureTypes = params.featureTypes || [];
    this._featureCount = X[0]?.length || 0;
    this._stats = {};
    this._classCounts = {};
    this._categoryValues = Array.from({ length: this._featureCount }, () => new Set());

    for (let j = 0; j < this._featureCount; j++) {
      if (this._featureTypes[j] !== 'numeric') {
        for (const row of X) this._categoryValues[j].add(this._value(row[j]));
      }
    }

    for (const cls of this._classes) {
      const rows = X.filter((_, i) => String(y[i]) === cls);
      this._classCounts[cls] = rows.length;
      this._stats[cls] = [];
      for (let j = 0; j < this._featureCount; j++) {
        const vals = rows.map(row => row[j]);
        if (this._featureTypes[j] === 'numeric') {
          const nums = vals.map(Number).filter(Number.isFinite);
          const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          const variance = nums.length
            ? nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nums.length
            : 0;
          this._stats[cls][j] = { kind: 'numeric', mean, variance: Math.max(variance, 1e-9) };
        } else {
          const counts = {};
          for (const v of vals) {
            const key = this._value(v);
            counts[key] = (counts[key] || 0) + 1;
          }
          this._stats[cls][j] = { kind: 'categorical', counts };
        }
      }
    }
    return this;
  },

  predict(X) {
    return X.map(row => {
      let bestClass = this._classes[0];
      let bestScore = -Infinity;
      for (const cls of this._classes) {
        let score = Math.log((this._classCounts[cls] + this._smoothing) /
          (Object.values(this._classCounts).reduce((a, b) => a + b, 0) + this._smoothing * this._classes.length));
        for (let j = 0; j < this._featureCount; j++) {
          const stat = this._stats[cls][j];
          if (stat.kind === 'numeric') {
            const value = Number(row[j]);
            if (!Number.isFinite(value)) continue;
            const variance = stat.variance;
            score += -0.5 * Math.log(2 * Math.PI * variance)
              - ((value - stat.mean) ** 2) / (2 * variance);
          } else {
            const key = this._value(row[j]);
            const k = Math.max(1, this._categoryValues[j].size);
            const count = stat.counts[key] || 0;
            score += Math.log((count + this._smoothing) /
              (this._classCounts[cls] + this._smoothing * k));
          }
        }
        if (score > bestScore) { bestScore = score; bestClass = cls; }
      }
      return bestClass;
    });
  },

  predictProba(X) {
    return X.map(row => {
      const scores = {};
      for (const cls of this._classes) {
        let score = Math.log((this._classCounts[cls] + this._smoothing) /
          (Object.values(this._classCounts).reduce((a, b) => a + b, 0) + this._smoothing * this._classes.length));
        for (let j = 0; j < this._featureCount; j++) {
          const stat = this._stats[cls][j];
          if (stat.kind === 'numeric') {
            const value = Number(row[j]);
            if (!Number.isFinite(value)) continue;
            score += -0.5 * Math.log(2 * Math.PI * stat.variance)
              - ((value - stat.mean) ** 2) / (2 * stat.variance);
          } else {
            const k = Math.max(1, this._categoryValues[j].size);
            score += Math.log(((stat.counts[this._value(row[j])] || 0) + this._smoothing) /
              (this._classCounts[cls] + this._smoothing * k));
          }
        }
        scores[cls] = score;
      }
      const max = Math.max(...Object.values(scores));
      const exp = Object.fromEntries(Object.entries(scores).map(([c, v]) => [c, Math.exp(v - max)]));
      const total = Object.values(exp).reduce((a, b) => a + b, 0) || 1;
      return Object.fromEntries(Object.entries(exp).map(([c, v]) => [c, v / total]));
    });
  },

  _value(value) {
    return value === null || value === undefined || value === '' ? '__MISSING__' : String(value).trim();
  },

  getClasses() { return this._classes || []; }
};
