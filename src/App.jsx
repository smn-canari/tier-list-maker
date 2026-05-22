import ImageBank from './components/ImageBank'
import './App.css'

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Tier List Maker</p>
          <h1>Build your image pool</h1>
        </div>
      </header>

      <ImageBank />
    </main>
  )
}

export default App
