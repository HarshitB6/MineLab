MineLab — DWM Analytics Workspace

Run locally:
1. Extract the ZIP.
2. Open index.html in Chrome/Edge.
3. Import a CSV/XLSX/XLS dataset.
4. Profile and preprocess it.
5. Run a mining task.
6. Open Results Hub and click Run full benchmark.
7. Export the comparison as CSV/XLSX or save charts as PNG.

Note: the app uses CDN-hosted Papa Parse, SheetJS, Chart.js and html2pdf.js libraries, so internet access is recommended when running the browser app.


V6 FIX NOTES
------------
- Fixed classification feature-matrix construction: categorical feature values are
  no longer silently converted to 0.
- Raw classification data now gets consistent one-hot encoding learned from the
  training split and reused on the test split.
- Preprocessed Label Encoding and One-Hot Encoding are respected without
  destroying the target.
- One-hot generated feature columns are now synchronized with the classification
  feature list.
- Classification model feature names now match the transformed matrix.
- Target column remains protected from feature encoding/scaling.
- These fixes particularly address Naive Bayes producing near-constant predictions.

PREPROCESSING IMPACT DEMO
--------------------------
- Load the built-in “Preprocessing Impact Demo” from Import Dataset → Load Sample Dataset, or upload preprocessing_impact_demo.csv.
- This is deterministic synthetic teaching data (800 generated records plus 24 exact duplicates), not real-world observations. It contains missing values in two informative numeric features and rare extreme values in process_noise; risk_class is the target.
- For the raw run, leave preprocessing unapplied. Use Classification → target risk_class → J48 Decision Tree → Run Classification. Record accuracy, macro precision, macro recall and macro F1.
- For the processed run, reload the same dataset, apply Median Imputation, remove duplicates, One-Hot Encoding and IQR outlier handling, then run the same classifier with the same 80/20 seed-42 split. Compare held-out metrics. The dataset is intended to show a benefit from preprocessing; measured results depend on the chosen algorithm and settings.

RETAIL CUSTOMER PREPROCESSING BENCHMARK
---------------------------------------
- Use the existing retail_customer_50000_CORRECTED.csv file. It is a synthetic benchmark, not observed customer data. It keeps 50,000 rows and 19 columns, with 25,000 No / 25,000 Yes labels so raw accuracy is not inflated by a majority-class baseline.
- Customer_Churn is balanced synthetic data. Missingness in the six numeric signal columns is deliberately class-dependent, while the raw zero rates are balanced between classes. This tests missing-value preprocessing; it is not a real-world churn benchmark.
- Import the CSV, choose Customer_Churn as the classification target, and use an 80/20 stratified split with seed 42. Preprocessing uses median imputation, one-hot encoding, explicit missing-value indicators and keeps duplicates, so row count stays at 50,000. Only the selected classification and regression targets are protected from preprocessing.
- On the held-out split, project modules returned the following accuracy / macro precision / macro F1 scores:
  - Naive Bayes: raw 50.25% / 50.61% / 41.60%; preprocessed 60.76% / 60.78% / 60.74%.
  - Logistic Regression: raw 49.44% / 49.41% / 48.87%; preprocessed 61.73% / 61.73% / 61.73%.
  - J48 (depth 2): raw 49.87% / 49.78% / 44.30%; preprocessed 57.56% / 58.74% / 56.08%.
- Naive Bayes and Logistic Regression are in the requested raw-under-60% and preprocessed-over-60%/under-80% range. J48 at the current depth-2 default does not cross 60% after preprocessing. These scores are for this constructed benchmark, not expected real-world churn performance.
- Regression demo: select Avg_Order_Value as the target and Monthly_Income, Discount_Usage_Pct, Products_Per_Order and Website_Visits as features. Multiple Linear Regression on an 80/20 seed-42 split returns raw MAE 73.49, RMSE 92.44, R² 0.7195; with median imputation it returns MAE 72.22, RMSE 90.19, R² 0.7330. The target is synthetically generated from those four features with added noise; this is for demonstrating regression, not real customer behavior.
