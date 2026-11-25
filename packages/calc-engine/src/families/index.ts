import { families, type Family } from '../template'
export const oneElectronNernstSlope = 0.05916

function diproticProtonationFactor(pH: number, pKa1: number, pKa2: number) {
  return 1 + 10 ** (pKa2 - pH) + 10 ** (pKa1 + pKa2 - 2 * pH)
}

function bisect(f: (x: number) => number, lo: number, hi: number) {
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) > 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}
export function calculate(
  family: Family,
  p: number[],
): { answer: number; reference: number; mean: number | null } {
  if (!families.includes(family)) throw Error('Unknown calculation family')
  if (p.some((v) => !Number.isFinite(v) || (family !== 'sample-sd' && v <= 0)))
    throw Error('Parameters must be positive finite numbers')
  const [a, b, c, d] = p as [number, number, number, number]
  if (
    ((family === 'buffer' ||
      family === 'weak-acid-titration' ||
      family === 'edta-equivalence') &&
      p.length !== 3) ||
    (family === 'redox-titration' && p.length !== 3 && p.length !== 4) ||
    (family === 'redox-equivalence-volume' && p.length !== 4) ||
    ((family === 'diprotic-salt-solubility' ||
      family === 'diprotic-2-to-1-solubility') &&
      p.length !== 4) ||
    ((family === 'edta-metal-side-reactions' ||
      family === 'edta-active-ligand') &&
      p.length !== 4) ||
    (family === 'strong-acid' && p.length !== 1) ||
    ((family === 'weak-acid-concentration' ||
      family === 'diprotic-2-to-1-solubility-ratio') &&
      p.length !== 2) ||
    (family === 'weak-acid-mass' && p.length !== 4) ||
    (family.startsWith('surplus-') && p.length !== 2) ||
    (family === 'sample-sd' && p.length < 2)
  )
    throw Error('Invalid parameter count')
  switch (family) {
    case 'strong-acid': {
      if (a > 1 || a < 1e-8) throw Error('Concentration outside example domain')
      const h = (a + Math.sqrt(a * a + 4e-14)) / 2
      return {
        answer: -Math.log10(h),
        reference: -Math.log10(bisect((x) => x - 1e-14 / x - a, 1e-16, 2)),
        mean: null,
      }
    }
    case 'weak-acid-concentration':
    case 'weak-acid-mass': {
      const [pH, pKa] = [a, b]
      if (pH < 2.5 || pH > 3.6 || pKa < 3.5 || pKa > 4.3)
        throw Error('Weak acid outside example domain')
      const hydrogen = 10 ** -pH
      const ka = 10 ** -pKa
      const scale = family === 'weak-acid-mass' ? c * d : 1
      if (
        family === 'weak-acid-mass' &&
        (c < 0.1 || c > 1 || d < 60 || d > 180)
      )
        throw Error('Weak acid mass outside example domain')
      return {
        answer: (hydrogen + hydrogen ** 2 / ka) * scale,
        reference:
          scale *
          bisect(
            (concentration) =>
              concentration / (1 + 10 ** (pKa - pH)) - hydrogen,
            0,
            1,
          ),
        mean: null,
      }
    }
    case 'weak-acid-titration': {
      const [pKa, stock, fraction] = [a, b, c]
      if (
        pKa < 2.8 ||
        pKa > 4.6 ||
        stock < 0.05 ||
        stock > 0.2 ||
        (fraction !== 0.5 && fraction !== 1)
      )
        throw Error('Weak acid titration outside example domain')
      const total = stock / (1 + fraction)
      const sodium = total * fraction
      const ka = 10 ** -pKa
      const kw = 1e-14
      // Multiply charge balance by h(h + Ka) to solve for the positive root.
      const hydrogen = bisect(
        (h) => (h * (h + sodium) - kw) * (h + ka) - total * ka * h,
        0,
        1,
      )
      // Cross-check directly in pH using the fraction of acid present as A−.
      const reference = bisect(
        (pH) => {
          const h = 10 ** -pH
          return total / (1 + h / ka) + kw / h - sodium - h
        },
        0,
        14,
      )
      return { answer: -Math.log10(hydrogen), reference, mean: null }
    }
    case 'redox-titration': {
      const [oxidantPotential, analytePotential, target] = [a, b, c]
      const slope = p[3] ?? oneElectronNernstSlope
      if (
        oxidantPotential < 1.4 ||
        oxidantPotential > 1.8 ||
        analytePotential < 0.65 ||
        analytePotential > 0.85 ||
        (target !== 1 && target !== 2) ||
        slope < 0.058 ||
        slope > 0.06
      )
        throw Error('Redox titration outside example domain')
      // At equivalence both reactants have the same residual concentration,
      // and both products have the same concentration.
      const logRatio = bisect(
        (ratio) =>
          analytePotential + slope * ratio - (oxidantPotential - slope * ratio),
        0,
        20,
      )
      return target === 1
        ? {
            answer: (oxidantPotential - analytePotential) / slope,
            reference: 2 * logRatio,
            mean: null,
          }
        : {
            answer: (oxidantPotential + analytePotential) / 2,
            reference: analytePotential + slope * logRatio,
            mean: null,
          }
    }
    case 'redox-equivalence-volume': {
      const [sampleVolume, sampleNormality, titrantNormality, target] = [
        a,
        b,
        c,
        d,
      ]
      if (
        sampleVolume < 10 ||
        sampleVolume > 50 ||
        sampleNormality < 0.05 ||
        sampleNormality > 0.15 ||
        titrantNormality < 0.05 ||
        titrantNormality > 0.25 ||
        (target !== 1 && target !== 2)
      )
        throw Error('Redox volume outside example domain')
      const titrantVolume = (sampleNormality * sampleVolume) / titrantNormality
      const initialVolume = target === 2 ? sampleVolume : 0
      return {
        answer: initialVolume + titrantVolume,
        reference: bisect(
          (volume) =>
            titrantNormality * (volume - initialVolume) -
            sampleNormality * sampleVolume,
          initialVolume,
          initialVolume + 200,
        ),
        mean: null,
      }
    }
    case 'edta-equivalence':
    case 'edta-metal-side-reactions':
    case 'edta-active-ligand': {
      const [logBeta, pAlpha, total] = [a, b, c]
      const metalSideFactor = family === 'edta-equivalence' ? 1 : d
      if (
        logBeta < 9.5 ||
        logBeta > 20 ||
        pAlpha < 1 ||
        pAlpha > 8 ||
        total < 0.003 ||
        total > 0.015 ||
        metalSideFactor < 1 ||
        metalSideFactor > 1000
      )
        throw Error('EDTA equilibrium outside example domain')
      const conditionalBeta = 10 ** (logBeta - pAlpha) / metalSideFactor
      // Equal analytical totals give equal concentrations of uncomplexed groups.
      // The positive root of x + β′x² = total is written without subtraction.
      const uncomplexed =
        (2 * total) / (1 + Math.sqrt(1 + 4 * conditionalBeta * total))
      const reference = bisect(
        (freeLigand) =>
          freeLigand -
          total /
            (1 +
              (10 ** logBeta * (10 ** -pAlpha * freeLigand)) / metalSideFactor),
        0,
        total,
      )
      if (family === 'edta-active-ligand') {
        const scale = 10 ** (12 - pAlpha)
        return {
          answer: uncomplexed * scale,
          reference: reference * scale,
          mean: null,
        }
      }
      return {
        answer: (uncomplexed / metalSideFactor) * 1e6,
        reference: (reference / metalSideFactor) * 1e6,
        mean: null,
      }
    }
    case 'diprotic-salt-solubility':
    case 'diprotic-2-to-1-solubility': {
      const [pH, pKa1, pKa2, pKsp] = [a, b, c, d]
      const twoCations = family === 'diprotic-2-to-1-solubility'
      const [minPKsp, maxPKsp] = twoCations ? [9.5, 12.5] : [7, 9]
      if (
        (pH !== 2 && pH !== 7) ||
        pKa1 < 1 ||
        pKa1 > 2 ||
        pKa2 < 3.5 ||
        pKa2 > 4.7 ||
        pKsp < minPKsp ||
        pKsp > maxPKsp
      )
        throw Error('Diprotic salt solubility outside example domain')
      const ksp = 10 ** -pKsp
      const protonationFactor = diproticProtonationFactor(pH, pKa1, pKa2)
      // Use the independent fractional composition of H₂A, HA− and A²−.
      const hydrogen = 10 ** -pH
      const ka1 = 10 ** -pKa1
      const kaProduct = 10 ** -(pKa1 + pKa2)
      const anionFraction =
        kaProduct / (hydrogen ** 2 + ka1 * hydrogen + kaProduct)
      return {
        answer:
          (twoCations
            ? Math.cbrt((ksp * protonationFactor) / 4)
            : Math.sqrt(ksp * protonationFactor)) * 1e6,
        reference:
          bisect(
            (s) => {
              const cationProduct = twoCations ? (2 * s) ** 2 : s
              return cationProduct * (s * anionFraction) - ksp
            },
            0,
            1,
          ) * 1e6,
        mean: null,
      }
    }
    case 'diprotic-2-to-1-solubility-ratio': {
      // The same pKsp cancels in the ratio. Use an in-domain value to check both equilibria.
      const acidic = calculate('diprotic-2-to-1-solubility', [2, a, b, 10])
      const neutral = calculate('diprotic-2-to-1-solubility', [7, a, b, 10])
      return {
        answer: Math.cbrt(
          diproticProtonationFactor(2, a, b) /
            diproticProtonationFactor(7, a, b),
        ),
        reference: acidic.reference / neutral.reference,
        mean: null,
      }
    }
    case 'buffer': {
      if (a < 2 || a > 10 || b / c < 1e-2 || b / c > 100)
        throw Error('Buffer outside example domain')
      return {
        answer: a + Math.log10(b / c),
        reference: bisect((x) => 10 ** (x - a) * c - b, 0, 14),
        mean: null,
      }
    }
    case 'sample-sd': {
      if (p.length > 1000 || p.some((x) => Math.abs(x) > 1e6))
        throw Error('Sample outside example domain')
      const mean = p.reduce((sum, x) => sum + x, 0) / p.length
      const answer = Math.sqrt(
        p.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (p.length - 1),
      )
      let n = 0,
        m = 0,
        m2 = 0
      for (const x of p) {
        n++
        const delta = x - m
        m += delta / n
        m2 += delta * (x - m)
      }
      if (Math.abs(m - mean) > 1e-10 * Math.max(1, Math.abs(mean)))
        throw Error('Independent mean mismatch')
      return { answer, reference: Math.sqrt(m2 / (n - 1)), mean }
    }
    case 'surplus-rate':
      if (!p.every((x) => Number.isSafeInteger(x) && x <= 1e6))
        throw Error('Integer example units required')
      return {
        answer: (100 * a) / b,
        reference:
          Number((BigInt(a) * 100n * 1000000000000n) / BigInt(b)) / 1e12,
        mean: null,
      }
    case 'surplus-mass': {
      if (!p.every((x) => Number.isSafeInteger(x) && x <= 1e6))
        throw Error('Integer example units required')
      const numerator = BigInt(a) * BigInt(b)
      return {
        answer: (a * b) / 100,
        reference: Number(numerator / 100n) + Number(numerator % 100n) / 100,
        mean: null,
      }
    }
  }
}
