import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

const n = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
}

function normCDF(x) {
  return (1 + erf(x / Math.sqrt(2))) / 2;
}

function probabilityBetween(S, low, high, iv, T = 30 / 365) {
  const sigma = iv / 100;
  if (sigma <= 0 || S <= 0 || low <= 0 || high <= 0 || T <= 0) return 0;
  const zLow = Math.log(low / S) / (sigma * Math.sqrt(T));
  const zHigh = Math.log(high / S) / (sigma * Math.sqrt(T));
  return Math.max(0, normCDF(zHigh) - normCDF(zLow));
}

function expectedMove(S, iv, T = 30 / 365) {
  const sigma = iv / 100;
  return S * sigma * Math.sqrt(T);
}

function ironCondor(price, p) {
  const putSpread =
    Math.max(n(p.putShort) - price, 0) - Math.max(n(p.putLong) - price, 0);
  const callSpread =
    Math.max(price - n(p.callShort), 0) - Math.max(price - n(p.callLong), 0);
  return n(p.credit) - putSpread - callSpread;
}

function validateIronCondor(p) {
  if (n(p.putLong) >= n(p.putShort)) {
    return "El long put debe estar por debajo del short put";
  }
  if (n(p.callShort) >= n(p.callLong)) {
    return "El short call debe estar por debajo del long call";
  }
  if (n(p.putShort) >= n(p.callShort)) {
    return "Las patas centrales están invertidas";
  }
  if (n(p.credit) <= 0) {
    return "El crédito debe ser positivo";
  }
  return null;
}

function Field({ label, ...props }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input className="field-input" {...props} />
    </div>
  );
}

function Metric({ label, value, help }) {
  return (
    <>
      <div className="metric-help">
        <span className="metric-label">{label}</span>
        <div className="metric-tooltip">{help}</div>
      </div>
      <span className="metric-value">{value}</span>
    </>
  );
}

export default function App() {
  const [params, setParams] = useState({
    S: 100,
    putLong: 90,
    putShort: 95,
    callShort: 105,
    callLong: 110,
    credit: 2,
    iv: 25,
    dte: 30,
    bias: "neutral",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setParams({
      ...params,
      [name]: name === "bias" ? value : parseFloat(value),
    });
  };

  const error = validateIronCondor(params);

  const S = n(params.S);
  const breakevenLow = n(params.putShort) - n(params.credit);
  const breakevenHigh = n(params.callShort) + n(params.credit);
  const T = n(params.dte) / 365;

  const prob = probabilityBetween(
    S,
    breakevenLow,
    breakevenHigh,
    n(params.iv),
    T
  );

  const widthPut = n(params.putShort) - n(params.putLong);
  const widthCall = n(params.callLong) - n(params.callShort);
  const spreadWidth = Math.max(widthPut, widthCall);
  const maxLoss = spreadWidth - n(params.credit);
  const maxProfit = n(params.credit);
  const riskReward = maxLoss > 0 ? maxProfit / maxLoss : 0;

  const touchProb = Math.min(1, 2 * (1 - prob));
  const expMove = expectedMove(S, n(params.iv), T);
  const scenarioUp = S + expMove;
  const scenarioDown = S - expMove;

  const score = !error
    ? (prob > 0.6 ? 1 : 0) +
      (n(params.iv) > 20 ? 1 : 0) +
      (params.bias === "neutral" ? 1 : 0)
    : 0;

  const data = useMemo(() => {
    if (error || S <= 0) return [];
    const prices = [];
    for (let p = S * 0.5; p <= S * 1.5; p += S * 0.01) {
      prices.push({
        price: Number(p.toFixed(2)),
        retorno: ironCondor(p, params),
      });
    }
    return prices;
  }, [params, error, S]);

  const panelClass = error
    ? "summary-panel summary-error"
    : score >= 3
    ? "summary-panel summary-good"
    : score === 2
    ? "summary-panel summary-warn"
    : "summary-panel summary-error";

  const scoreText = error
    ? ""
    : score >= 3
    ? "✔ Setup coherente"
    : score === 2
    ? "⚠ Setup justo"
    : "✖ Setup débil";

  const scoreTextClass =
    score >= 3 ? "score-good" : score === 2 ? "score-warn" : "score-bad";

  return (
    <div className="app-shell">
      <div className="container">
        <header className="hero">
          <p className="eyebrow">NQOO Utilities</p>
          <h1>Short Iron Condor</h1>
          <p className="hero-copy">
            Evalúa coherencia, break-evens, riesgo, probabilidad y movimiento
            esperado de una estructura de iron condor.
          </p>
        </header>

        <div className="top-grid">
          <section className="card inputs-card">
            <div className="form-grid">
              <Field
                label="Precio subyacente"
                name="S"
                type="number"
                value={params.S}
                onChange={handleChange}
              />
              <Field
                label="Volatilidad implícita (%)"
                name="iv"
                type="number"
                value={params.iv}
                onChange={handleChange}
              />
              <Field
                label="Días a vencimiento (DTE)"
                name="dte"
                type="number"
                value={params.dte}
                onChange={handleChange}
              />

              <div className="field">
                <label className="field-label">Sesgo</label>
                <select
                  name="bias"
                  value={params.bias}
                  onChange={handleChange}
                  className="field-input"
                >
                  <option value="neutral">Neutral</option>
                  <option value="bullish">Alcista</option>
                  <option value="bearish">Bajista</option>
                </select>
              </div>

              <Field
                label="Crédito"
                name="credit"
                type="number"
                value={params.credit}
                onChange={handleChange}
              />
              <Field
                label="Long Put"
                name="putLong"
                type="number"
                value={params.putLong}
                onChange={handleChange}
              />
              <Field
                label="Short Put"
                name="putShort"
                type="number"
                value={params.putShort}
                onChange={handleChange}
              />
              <Field
                label="Short Call"
                name="callShort"
                type="number"
                value={params.callShort}
                onChange={handleChange}
              />
              <Field
                label="Long Call"
                name="callLong"
                type="number"
                value={params.callLong}
                onChange={handleChange}
              />
            </div>
          </section>

          <aside className={panelClass}>
            {error ? (
              <p className="error-text">{error}</p>
            ) : (
              <>
                <p className={`score-title ${scoreTextClass}`}>{scoreText}</p>

                <div className="metrics-grid">
                  <Metric
                    label="Break Even Inferior"
                    value={breakevenLow.toFixed(2)}
                    help="Precio al que la estrategia pasa de ganar a perder por abajo."
                  />
                  <Metric
                    label="Break Even Superior"
                    value={breakevenHigh.toFixed(2)}
                    help="Precio al que la estrategia pasa de ganar a perder por arriba."
                  />
                  <Metric
                    label="Max. Beneficio"
                    value={maxProfit.toFixed(2)}
                    help="Máximo beneficio posible, igual al crédito recibido."
                  />
                  <Metric
                    label="Max. Pérdida"
                    value={maxLoss.toFixed(2)}
                    help="Máxima pérdida posible, ancho del spread menos el crédito."
                  />
                  <Metric
                    label="Ratio riesgo-beneficio (R/R)"
                    value={`1 : ${riskReward.toFixed(2)}`}
                    help="Relación entre lo que arriesgas y lo que puedes ganar."
                  />
                  <Metric
                    label="Prob. de acabar en rango *"
                    value={`${(prob * 100).toFixed(1)}%`}
                    help="Probabilidad estimada de terminar dentro del rango con un modelo lognormal."
                  />
                  <Metric
                    label="Prob. de tocar strikes **"
                    value={`${(touchProb * 100).toFixed(1)}%`}
                    help="Aproximación simplificada de tocar alguno de los strikes durante la vida del trade."
                  />
                  <Metric
                    label="Movimiento esperado ***"
                    value={`${expMove.toFixed(2)} (${(
                      (expMove / (S || 1)) *
                      100
                    ).toFixed(1)}%)`}
                    help="Movimiento esperado a una desviación estándar basado en volatilidad implícita."
                  />
                </div>
              </>
            )}
          </aside>
        </div>

        {!error && (
          <section className="card note-card">
            {score >= 3 && (
              <>
                <p>La estructura es coherente (~{(prob * 100).toFixed(1)}% dentro del rango).</p>
                <p>Volatilidad adecuada y sesgo alineado.</p>
              </>
            )}

            {score === 2 && (
              <>
                <p>La estructura es razonable pero con dudas.</p>
                <p>Algún elemento no encaja del todo.</p>
              </>
            )}

            {score <= 1 && (
              <>
                <p>La estructura es débil (~{(prob * 100).toFixed(1)}% dentro del rango).</p>
                <p>Riesgo elevado frente a la prima.</p>
              </>
            )}

            <p>Movimiento esperado ≈ {expMove.toFixed(2)}.</p>
            <p>Riesgo/beneficio: 1 : {riskReward.toFixed(2)}</p>

            <p className="note-italic">
              Si este trade falla, probablemente será porque el precio se mueve
              más de lo que el mercado está descontando, más allá del movimiento esperado.
            </p>

            <div className="footnotes">
              <div>* Modelo lognormal (Black-Scholes)</div>
              <div>** Aproximación simplificada</div>
              <div>*** Aproximación 1σ (~68%)</div>
            </div>
          </section>
        )}

        {!error && (
          <section className="card chart-card">
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="price" />
                  <YAxis
                    label={{
                      value: "Retorno",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [Number(value).toFixed(2), "Retorno"]}
                  />

                  <ReferenceLine y={0} stroke="#1f2937" strokeWidth={2} />
                  <ReferenceLine y={maxProfit} stroke="#15803d" strokeDasharray="3 3" />

                  <ReferenceArea
                    x1={scenarioDown}
                    x2={scenarioUp}
                    fill="#f59e0b"
                    fillOpacity={0.08}
                  />
                  <ReferenceArea
                    x1={breakevenLow}
                    x2={breakevenHigh}
                    fill="#16a34a"
                    fillOpacity={0.1}
                  />
                  <ReferenceArea
                    x1={S * 0.5}
                    x2={n(params.putLong)}
                    fill="#dc2626"
                    fillOpacity={0.06}
                  />
                  <ReferenceArea
                    x1={n(params.callLong)}
                    x2={S * 1.5}
                    fill="#dc2626"
                    fillOpacity={0.06}
                  />

                  <ReferenceLine x={S} stroke="#f59e0b" />
                  <ReferenceLine
                    x={breakevenLow}
                    stroke="#16a34a"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    x={breakevenHigh}
                    stroke="#16a34a"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    x={n(params.putLong)}
                    stroke="#dc2626"
                    strokeDasharray="2 2"
                  />
                  <ReferenceLine
                    x={n(params.callLong)}
                    stroke="#dc2626"
                    strokeDasharray="2 2"
                  />

                  <Line
                    type="monotone"
                    dataKey="retorno"
                    stroke="#c2410c"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
