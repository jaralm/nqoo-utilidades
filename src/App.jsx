import React, { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function n(v) {
  const parsed = parseFloat(v)
  return Number.isNaN(parsed) ? 0 : parsed
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}

function normCDF(x) {
  return (1 + erf(x / Math.sqrt(2))) / 2
}

function probabilityBetween(S, low, high, iv, T = 30 / 365) {
  const sigma = iv / 100
  if (sigma <= 0 || low <= 0 || high <= 0 || S <= 0) return 0
  const zLow = Math.log(low / S) / (sigma * Math.sqrt(T))
  const zHigh = Math.log(high / S) / (sigma * Math.sqrt(T))
  return Math.max(0, normCDF(zHigh) - normCDF(zLow))
}

function touchProbability(prob) {
  return Math.min(1, prob * 2)
}

function expectedMove(S, iv, T = 30 / 365) {
  const sigma = iv / 100
  return S * sigma * Math.sqrt(T)
}

function ironCondor(price, p) {
  const putSpread = Math.max(n(p.putShort) - price, 0) - Math.max(n(p.putLong) - price, 0)
  const callSpread = Math.max(price - n(p.callShort), 0) - Math.max(price - n(p.callLong), 0)
  return n(p.credit) - putSpread - callSpread
}

function validateIronCondor(p) {
  if (n(p.putLong) >= n(p.putShort)) return 'El long put debe estar por debajo del short put.'
  if (n(p.callShort) >= n(p.callLong)) return 'El short call debe estar por debajo del long call.'
  if (n(p.putShort) >= n(p.callShort)) return 'Las patas centrales están invertidas.'
  if (n(p.credit) <= 0) return 'El crédito debe ser positivo.'
  return null
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
    bias: 'neutral',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setParams((prev) => ({
      ...prev,
      [name]: name === 'bias' ? value : parseFloat(value),
    }))
  }

  const error = validateIronCondor(params)
  const S = n(params.S)
  const breakevenLow = n(params.putShort) - n(params.credit)
  const breakevenHigh = n(params.callShort) + n(params.credit)
  const prob = probabilityBetween(S, breakevenLow, breakevenHigh, n(params.iv))
  const widthPut = n(params.putShort) - n(params.putLong)
  const widthCall = n(params.callLong) - n(params.callShort)
  const spreadWidth = Math.max(widthPut, widthCall)
  const maxLoss = spreadWidth - n(params.credit)
  const maxProfit = n(params.credit)
  const touchProb = touchProbability(prob)
  const expMove = expectedMove(S, n(params.iv))
  const scenarioUp = S + expMove
  const scenarioDown = S - expMove
  const riskReward = maxLoss > 0 ? maxProfit / maxLoss : 0

  const score = !error
    ? (prob > 0.6 ? 1 : 0) + (n(params.iv) >= 20 ? 1 : 0) + (params.bias === 'neutral' ? 1 : 0)
    : 0

  const panelTone = error
    ? 'danger'
    : score === 3
      ? 'good'
      : score === 2
        ? 'warn'
        : 'danger'

  const data = useMemo(() => {
    if (error || S <= 0) return []
    const prices = []
    for (let p = S * 0.5; p <= S * 1.5; p += S * 0.01) {
      prices.push({ price: Number(p.toFixed(2)), retorno: ironCondor(p, params) })
    }
    return prices
  }, [params, error, S])

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">No Queda Otra Opción</p>
        <h1>Utilidad básica para evaluar un Short Iron Condor</h1>
        <p className="hero-copy">
          Introduce strikes, crédito e IV para ver break-even, beneficio máximo, pérdida máxima,
          probabilidad aproximada y curva de retorno.
        </p>
      </header>

      <main className="layout">
        <section className="card form-card">
          <h2>1. Rellena los datos</h2>
          <div className="form-grid">
            <div>
              <label className="label">Precio subyacente</label>
              <input className="input" name="S" type="number" value={params.S} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Volatilidad implícita (%)</label>
              <input className="input" name="iv" type="number" value={params.iv} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Sesgo</label>
              <select className="input" name="bias" value={params.bias} onChange={handleChange}>
                <option value="neutral">Neutral</option>
                <option value="bullish">Alcista</option>
                <option value="bearish">Bajista</option>
              </select>
            </div>
            <div>
              <label className="label">Crédito</label>
              <input className="input" name="credit" type="number" value={params.credit} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Long Put</label>
              <input className="input" name="putLong" type="number" value={params.putLong} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Short Put</label>
              <input className="input" name="putShort" type="number" value={params.putShort} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Short Call</label>
              <input className="input" name="callShort" type="number" value={params.callShort} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Long Call</label>
              <input className="input" name="callLong" type="number" value={params.callLong} onChange={handleChange} />
            </div>
          </div>
        </section>

        <aside className={`card side-card ${panelTone}`}>
          <h2>2. Lee el resultado</h2>
          {error ? <p className="status error">{error}</p> : null}
          <p className="status">
            {error ? 'Corrige la estructura antes de interpretar el setup.' : score === 3 ? 'Setup coherente.' : score === 2 ? 'Setup aceptable.' : 'Setup débil.'}
          </p>
          <div className="metrics">
            <div><span>Break-even inferior</span><strong>{breakevenLow.toFixed(2)}</strong></div>
            <div><span>Break-even superior</span><strong>{breakevenHigh.toFixed(2)}</strong></div>
            <div><span>Máx. beneficio</span><strong>{maxProfit.toFixed(2)}</strong></div>
            <div><span>Máx. pérdida</span><strong>{maxLoss.toFixed(2)}</strong></div>
            <div><span>Riesgo/beneficio</span><strong>1:{riskReward.toFixed(2)}</strong></div>
            <div><span>Prob. en rango</span><strong>{(prob * 100).toFixed(1)}%</strong></div>
            <div><span>Prob. tocar strikes</span><strong>{(touchProb * 100).toFixed(1)}%</strong></div>
            <div><span>Movimiento esperado</span><strong>{expMove.toFixed(2)}</strong></div>
          </div>
        </aside>

        <section className="card note-card">
          <h2>3. Interpretación rápida</h2>
          <p>
            Este modelo es una aproximación simple basada en una distribución lognormal y en un movimiento esperado a una desviación estándar.
          </p>
          <p>
            No sustituye tu análisis de volatilidad, skew, calendario, liquidez ni gestión del riesgo. Úsalo como filtro inicial, no como decisión automática.
          </p>
        </section>

        <section className="card chart-card">
          <h2>4. Curva de retorno</h2>
          {error ? (
            <p className="muted">El gráfico aparecerá cuando la estructura sea válida.</p>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6d0c7" />
                  <XAxis dataKey="price" />
                  <YAxis />
                  <Tooltip formatter={(value) => [Number(value).toFixed(2), 'Retorno']} />
                  <ReferenceLine y={0} stroke="#1f1f1f" strokeWidth={2} />
                  <ReferenceLine y={maxProfit} stroke="#2f7d32" strokeDasharray="4 4" />
                  <ReferenceArea x1={scenarioDown} x2={scenarioUp} fill="#e7c58d" fillOpacity={0.16} />
                  <ReferenceArea x1={breakevenLow} x2={breakevenHigh} fill="#8fbc8f" fillOpacity={0.2} />
                  <ReferenceArea x1={S * 0.5} x2={n(params.putLong)} fill="#d99a9a" fillOpacity={0.12} />
                  <ReferenceArea x1={n(params.callLong)} x2={S * 1.5} fill="#d99a9a" fillOpacity={0.12} />
                  <ReferenceLine x={S} stroke="#b56d18" />
                  <ReferenceLine x={breakevenLow} stroke="#2f7d32" strokeDasharray="4 4" />
                  <ReferenceLine x={breakevenHigh} stroke="#2f7d32" strokeDasharray="4 4" />
                  <ReferenceLine x={n(params.putLong)} stroke="#b0413e" strokeDasharray="2 2" />
                  <ReferenceLine x={n(params.callLong)} stroke="#b0413e" strokeDasharray="2 2" />
                  <Line type="monotone" dataKey="retorno" stroke="#8d4b14" dot={false} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}