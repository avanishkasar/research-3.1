# One-Page Project Explainer (Simple Version)

## Project Goal
We predict the best launch week and best launch price for an e-commerce product category in India.

The model combines:
- historical sales behavior (from Amazon-style product data)
- Google Trends search interest (India)

---

## What the App Does (Step by Step)
1. Upload CSV data.
2. Clean data (remove rupee symbols, commas, invalid values).
3. Build weekly sales timeline.
4. Fetch Google Trends for selected keyword.
5. Merge sales + trends by week.
6. Create model features (lag values, rolling averages, momentum).
7. Train SARIMA baseline model.
8. Train XGBoost + Trends model.
9. Forecast next N weeks.
10. Find best launch week (week with highest forecasted demand).
11. Optimize price (test price range and pick best revenue point).

---

## How Best Launch Timing Is Found
- The app uses the historical date window shown in the results.
- It predicts demand for each week in the future horizon (example: next 8 weeks).
- The week with highest predicted units is marked as the best launch week.

So yes, launch timing is based on the data timeline + forecast horizon.

---

## What RMSE and MAPE Mean
- RMSE: average size of prediction error in "units sold" scale.
  - Lower is better.
- MAPE: average percentage error.
  - Lower is better.
  - Easy benchmark:
    - <10%: Excellent
    - 10-20%: Good
    - 20-30%: Acceptable
    - >30%: Weak

---

## Interpreting Your Current Numbers
Given:
- ARIMA RMSE = 11,681.0
- ARIMA MAPE = 3.94%
- XGBoost RMSE = 10,756.0
- XGBoost MAPE = 3.38%

Interpretation:
- Both models are already in the "Excellent" range (MAPE < 10%).
- XGBoost is better because both RMSE and MAPE are lower.
- RMSE improvement: about 7.9% lower than ARIMA.
- MAPE improvement: about 14.2% lower than ARIMA.

This is a strong result for faculty presentation.

---

## About Estimated Revenue
Example shown: ₹541,437,417 weekly estimated revenue.

This comes from:
- optimized price x predicted demand

Important note for faculty:
- Revenue value is model-based estimate, not guaranteed actual.
- It is best used for comparing scenarios (different categories, prices, and keywords).

---

## How to Use for Faculty Demo
1. Choose a product category in the app.
2. Set custom launch price (optional).
3. Run analysis.
4. Show:
   - Model Fit tab (Actual vs Predicted)
   - Model Performance metrics
   - Launch timing explanation section
   - Summary table with timeline and category scope
5. Conclude with: "Lower error + clear trend alignment + transparent timeline logic".
