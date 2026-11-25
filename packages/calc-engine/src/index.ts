import { sample, validateTemplate, random, type Template } from './template'
import { calculate, oneElectronNernstSlope } from './families'
import { distractors, format } from './distractors'
export { calculate, format }
export {
  families,
  maxSeedLength,
  type Family,
  type Rounding,
  type Template,
} from './template'
export function generate(template: Template, seed: string) {
  validateTemplate(template)
  const p = sample(template.family, seed),
    result = calculate(template.family, p)
  if (
    Math.abs(result.answer - result.reference) >
    template.tolerance * Math.max(1, Math.abs(result.answer))
  )
    throw Error('Independent calculation mismatch')
  const [a, b, c, d] = p as [number, number, number, number]
  let stem = '',
    formula = '',
    unit = '',
    errors: number[] = []
  switch (template.family) {
    case 'strong-acid':
      stem = `Ví dụ tổng hợp: dung dịch acid mạnh một nấc $\\ce{HCl}$ có nồng độ ${a.toExponential(3)} mol/L ở 25 °C; lấy $K_w=10^{-14}$. Tính pH.`
      formula =
        '$[\\ce{H+}]=(C+\\sqrt{C^2+4K_w})/2$; $pH=-\\log_{10}[\\ce{H+}]$'
      errors = [Math.log10(a), -Math.log(a), -Math.log10(a) + 1]
      break
    case 'weak-acid-concentration':
      stem = `Ví dụ tổng hợp: dung dịch chỉ chứa một axit yếu một nấc tan trong nước, pH=${a} và pKa=${b}. Bỏ qua sự tự ion hóa của nước. Tính nồng độ ban đầu của axit.`
      formula =
        '$h=10^{-pH}$, $K_a=10^{-pK_a}$, $K_a=h^2/(C-h)$, nên $C=h+h^2/K_a$'
      unit = 'mol/L'
      errors = [10 ** -a, 10 ** (b - 2 * a), 10 ** (a - 2 * b)]
      break
    case 'weak-acid-mass':
      stem = `Ví dụ tổng hợp: pha ${c} L dung dịch cuối chỉ chứa một axit yếu một nấc, với pH=${a}, pKa=${b} và khối lượng mol ${d} g/mol. Bỏ qua sự tự ion hóa của nước. Tính khối lượng axit cần dùng theo gam.`
      formula =
        'Với $h=10^{-pH}$ và $K_a=10^{-pK_a}$, cân bằng cho nồng độ ban đầu $C=h+h^2/K_a$. Số mol axit là $CV$, nên khối lượng là $m=CVM$ với $V$ tính bằng L và $M$ tính bằng g/mol'
      errors = [result.answer / d, result.answer / c, 10 ** -a * c * d]
      unit = 'g'
      break
    case 'weak-acid-titration': {
      const stage = c === 0.5 ? 'bán tương đương' : 'tương đương'
      stem = `Ví dụ tổng hợp: chuẩn độ axit yếu một nấc có pKa=${a} bằng NaOH. Hai dung dịch ban đầu đều có nồng độ ${b} mol/L. Tính pH tại điểm ${stage}, giả sử dung dịch lý tưởng, thể tích cộng được và $K_w=10^{-14}$ ở 25 °C.`
      formula = `Tỉ số số mol NaOH/axit ban đầu là $f=${c}$. Sau pha loãng, nồng độ tổng các dạng axit là $C=${b}/(1+f)$ và nồng độ natri là $fC$. Giải cân bằng điện tích $h+fC=K_w/h+CK_a/(h+K_a)$ với $K_a=10^{-pK_a}$, rồi tính $pH=-\\log_{10}(h)$`
      errors = [a, 7, 14 - result.answer]
      break
    }
    case 'redox-titration': {
      const common = `Ví dụ tổng hợp ở 25 °C: dùng dạng oxy hóa của cặp X để chuẩn độ dạng khử của cặp Y. Mỗi cặp trao đổi một electron. Thế khử chuẩn của X và Y lần lượt là ${a} V và ${b} V. Giả sử dung dịch lý tưởng và chỉ có phản ứng oxy hóa–khử giữa hai cặp.`
      if (c === 1) {
        stem = `${common} Dùng hệ số Nernst ${oneElectronNernstSlope} V, tính $\\log_{10}K$ cho phản ứng chuẩn độ theo chiều đã nêu.`
        formula = `Với $n=1$, $\\log_{10}K=(E^\\circ_X-E^\\circ_Y)/${oneElectronNernstSlope}$`
        errors = [
          -(a - b) / oneElectronNernstSlope,
          (a - b) / (2 * oneElectronNernstSlope),
          (a + b) / oneElectronNernstSlope,
        ]
      } else {
        stem = `${common} Tính thế điện cực của dung dịch ở điểm tương đương.`
        formula =
          'Tại tương đương, hai chất phản ứng còn dư có cùng nồng độ và hai sản phẩm có cùng nồng độ. Hai phương trình Nernst có số hạng logarit trái dấu. Cộng hai phương trình cho $E=(E^\\circ_X+E^\\circ_Y)/2$'
        unit = 'V'
        errors = [a, b, a - b]
      }
      break
    }
    case 'redox-equivalence-volume': {
      const target =
        d === 1 ? 'thể tích dung dịch chuẩn đã thêm' : 'tổng thể tích dung dịch'
      stem = `Ví dụ tổng hợp: chuẩn độ oxy hóa–khử ${a} mL dung dịch mẫu có nồng độ đương lượng ${b} N bằng dung dịch chuẩn ${c} N. Giả sử thể tích cộng được. Tính ${target} tại điểm tương đương.`
      formula = '$N_{m}V_{m}=N_{c}V_{c}$, nên $V_c=N_mV_m/N_c$'
      if (d === 2) formula += ' và $V_{tong}=V_m+V_c$'
      unit = 'mL'
      errors = [a, (a * c) / b, d === 1 ? result.answer + a : result.answer - a]
      break
    }
    case 'edta-equivalence':
      stem = `Ví dụ tổng hợp: tại điểm tương đương của chuẩn độ kim loại M bằng EDTA, nồng độ phân tích sau pha loãng của mỗi chất là ${c} mol/L. Phức MY có $\\log_{10}\\beta=${a}$. Ở pH cố định, phần EDTA chưa tạo phức ở dạng $\\ce{Y^4-}$ là $\\alpha=10^{-${b}}$. Chỉ xét phức 1:1 và bỏ qua phản ứng phụ của kim loại. Tính nồng độ M tự do theo μmol/L.`
      formula =
        'Hằng số bền có điều kiện là $\\beta^\\prime=\\beta\\alpha$. Hai chất có cùng nồng độ phân tích $C$ nên nồng độ M tự do và tổng EDTA chưa tạo phức bằng nhau, cùng là $x$. Do đó $C=x+\\beta^\\prime x^2$. Lấy nghiệm dương và nhân $10^6$ để đổi sang μmol/L'
      unit = 'μmol/L'
      errors = [Math.sqrt(c * 10 ** -a) * 1e6, c * 1e6, 0]
      break
    case 'edta-metal-side-reactions':
      stem = `Ví dụ tổng hợp: tại tương đương của chuẩn độ kim loại M bằng EDTA, nồng độ phân tích sau pha loãng của mỗi chất là ${c} mol/L. Phức MY có $\\log_{10}\\beta=${a}$. Ở pH cố định, phần EDTA chưa tạo phức ở dạng $\\ce{Y^4-}$ là $\\alpha_Y=10^{-${b}}$. Tổng kim loại ngoài phức MY bằng ${d} lần nồng độ M tự do. Tính nồng độ M tự do theo μmol/L.`
      formula = `Với hệ số phản ứng phụ $F_M=${d}$, hằng số bền có điều kiện là $\\beta^\\prime=\\beta\\alpha_Y/F_M$. Gọi $x$ là tổng nồng độ kim loại ngoài phức MY, bằng tổng EDTA ngoài phức MY tại tương đương. Giải $C=x+\\beta^\\prime x^2$, sau đó lấy $x/F_M$ và nhân $10^6$ để đổi sang μmol/L`
      unit = 'μmol/L'
      errors = [result.answer * d, result.answer / d, (c * 1e6) / d]
      break
    case 'edta-active-ligand':
      stem = `Ví dụ tổng hợp: tại điểm tương đương của chuẩn độ kim loại M bằng EDTA, nồng độ phân tích sau pha loãng của mỗi chất là ${c} mol/L. Phức MY có $\\log_{10}\\beta=${a}$. Ở pH cố định, phần EDTA ngoài phức MY ở dạng $\\ce{Y^4-}$ là $\\alpha_Y=10^{-${b}}$. Tổng kim loại ngoài MY bằng ${d} lần nồng độ M tự do. Tính nồng độ $\\ce{Y^4-}$ theo pmol/L.`
      formula = `Đặt $F_M=${d}$, khi đó $\\beta^\\prime=\\beta\\alpha_Y/F_M$. Tại tương đương, tổng EDTA ngoài phức MY bằng tổng kim loại ngoài phức MY, cùng là $x$. Giải $C=x+\\beta^\\prime x^2$, lấy $[\\ce{Y^4-}]=\\alpha_Y x$ rồi nhân $10^{12}$ để đổi sang pmol/L`
      unit = 'pmol/L'
      errors = [result.answer * 10 ** b, result.answer / d, c * 10 ** (12 - b)]
      break
    case 'diprotic-salt-solubility': {
      const noProtonation = Math.sqrt(10 ** -d) * 1e6
      stem = `Ví dụ tổng hợp: muối ít tan MA phân ly thành $\\ce{M^2+}$ và $\\ce{A^2-}$, với $pK_{sp}=${d}$. Axit $\\ce{H2A}$ có $pK_{a1}=${b}$ và $pK_{a2}=${c}$. Dung dịch đệm giữ pH=${a}, không có sẵn các ion của muối. Bỏ qua phản ứng phụ của kim loại và xem hoạt độ bằng nồng độ. Tính độ tan mol theo μmol/L.`
      formula =
        'Đặt $h=10^{-pH}$ và $F=1+h/K_{a2}+h^2/(K_{a1}K_{a2})$. Nếu độ tan mol là $s$, cân bằng vật chất cho $[\\ce{M^2+}]=s$ và $[\\ce{A^2-}]=s/F$. Vì $K_{sp}=s^2/F$, lấy $s=\\sqrt{K_{sp}F}$ rồi nhân $10^6$ để đổi sang μmol/L'
      unit = 'μmol/L'
      errors = [
        noProtonation,
        noProtonation ** 2 / result.answer,
        result.answer / 2,
      ]
      break
    }
    case 'diprotic-2-to-1-solubility': {
      const ksp = 10 ** -d
      const noProtonation = Math.cbrt(ksp / 4) * 1e6
      stem = `Ví dụ tổng hợp: muối ít tan $\\ce{M2A}$ có $pK_{sp}=${d}$, phân ly cho hai ion $\\ce{M+}$ và một ion $\\ce{A^2-}$. Axit $\\ce{H2A}$ có $pK_{a1}=${b}$ và $pK_{a2}=${c}$. Dung dịch đệm giữ pH=${a} và không có sẵn các ion của muối. Bỏ qua phản ứng phụ của kim loại và xem hoạt độ bằng nồng độ. Tính độ tan mol theo μmol/L.`
      formula =
        'Đặt $h=10^{-pH}$ và $F=1+h/K_{a2}+h^2/(K_{a1}K_{a2})$. Với độ tan $s$, cân bằng vật chất cho $[\\ce{M+}]=2s$ và $[\\ce{A^2-}]=s/F$. Thế vào $K_{sp}=(2s)^2(s/F)$ cho $s=\\sqrt[3]{K_{sp}F/4}$ rồi nhân $10^6$ để đổi sang μmol/L'
      unit = 'μmol/L'
      errors = [
        noProtonation,
        result.answer * Math.cbrt(4),
        Math.sqrt(ksp) * 1e6,
      ]
      break
    }
    case 'diprotic-2-to-1-solubility-ratio':
      stem = `Ví dụ tổng hợp: muối ít tan $\\ce{M2A}$ phân ly cho hai ion $\\ce{M+}$ và một ion $\\ce{A^2-}$. Axit $\\ce{H2A}$ có $pK_{a1}=${a}$ và $pK_{a2}=${b}$. So sánh độ tan mol của cùng muối ở pH 2 và pH 7 bằng cách tính $s_{pH=2}/s_{pH=7}$. Giả sử pH được giữ cố định, dung dịch lý tưởng, không có ion chung và không có phản ứng phụ của kim loại.`
      formula =
        'Với $h=10^{-pH}$, hệ số proton hóa là $F=1+h/K_{a2}+h^2/(K_{a1}K_{a2})$. Do $K_{sp}=4s^3/F$ và $K_{sp}$ giống nhau ở hai pH, tỷ số là $s_{pH=2}/s_{pH=7}=\\sqrt[3]{F_{pH=2}/F_{pH=7}}$'
      errors = [1, 1 / result.answer, result.answer ** 1.5]
      break
    case 'buffer':
      stem = `Ví dụ tổng hợp: dung dịch đệm lý tưởng có pKa=${a}, tỉ lệ lượng base liên hợp/acid=${b}/${c}; dùng gần đúng Henderson–Hasselbalch. Tính pH.`
      formula = '$pH=pK_a+\\log_{10}(n_{base}/n_{acid})$'
      errors = [a - Math.log10(b / c), Math.log10(b / c), a + Math.log(b / c)]
      break
    case 'sample-sd':
      stem = `Ví dụ tổng hợp: các phép đo cùng đơn vị u là ${p.join('; ')}. Tính độ lệch chuẩn mẫu (mẫu số n−1).`
      formula =
        '$\\bar{x}=\\sum x_i/n$; $s=\\sqrt{\\sum(x_i-\\bar{x})^2/(n-1)}$'
      unit = 'u'
      errors = [
        result.answer * Math.sqrt((p.length - 1) / p.length),
        result.answer ** 2,
        result.mean!,
      ]
      break
    case 'surplus-rate':
      stem = `Ví dụ KTCT tổng hợp: giá trị thặng dư m=${a}, tư bản khả biến v=${b} (cùng đơn vị). Tính tỉ suất giá trị thặng dư m′.`
      formula = "$m'=100m/v$"
      unit = '%'
      errors = [a / b, (100 * b) / a, (100 * a) / (a + b)]
      break
    case 'surplus-mass':
      stem = `Ví dụ KTCT tổng hợp: tỉ suất giá trị thặng dư m′=${a}%, tổng tư bản khả biến V=${b} đơn vị giá trị. Tính khối lượng giá trị thặng dư M.`
      formula = "$M=(m'/100)V$"
      unit = 'đơn vị giá trị'
      errors = [a * b, b / a, a / b]
      break
  }
  const { decimals, rounding } = template
  const answer = format(result.answer, decimals, rounding),
    wrong = distractors(result.answer, decimals, errors, rounding)
  const roundingRule =
    rounding === 'half-even'
      ? 'nếu đúng giữa hai giá trị, giữ chữ số cuối chẵn'
      : 'quy tắc ví dụ, chưa phải quy định đề thật'
  const next = random(seed, ':choices'),
    values = [answer, ...wrong]
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[values[i], values[j]] = [values[j]!, values[i]!]
  }
  return {
    family: template.family,
    seed,
    parameters: p,
    decimals: template.decimals,
    unit,
    answer,
    reference: result.reference,
    mean: result.mean,
    stem: stem + ` Làm tròn ${decimals} chữ số sau dấu phẩy (${roundingRule}).`,
    explanation: `${formula}. ${result.mean === null ? '' : `Trung bình mẫu: ${format(result.mean, decimals, rounding)} u. `}Kết quả: ${answer} ${unit}. Hai cách tính đã đối chiếu; dữ liệu mẫu tự tạo.`,
    choices: values.map((v, i) => ({
      label: ['A', 'B', 'C', 'D'][i]!,
      text: v + (unit ? ' ' + unit : ''),
      is_correct: v === answer,
    })),
  }
}
