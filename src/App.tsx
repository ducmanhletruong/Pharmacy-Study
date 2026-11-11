import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const appName = import.meta.env.VITE_APP_NAME || 'Web Starter'

  return (
    <main>
      <p className="eyebrow">REACT · TYPESCRIPT · VITE</p>
      <h1>{appName}</h1>
      <p>
        Môi trường đã sẵn sàng. Sửa <code>src/App.tsx</code> và lưu để thấy thay
        đổi ngay.
      </p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Bạn đã bấm {count} lần
      </button>
      <p className="hint">
        Chạy <code>npm run check</code> trước khi commit.
      </p>
    </main>
  )
}

export default App
