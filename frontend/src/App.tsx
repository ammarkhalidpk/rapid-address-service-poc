function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
          <h1 className="text-4xl font-bold mb-4">Rapid Address Service POC</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Australian Address Search & Validation
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div>React 19.2</div>
            <div>•</div>
            <div>TypeScript 5.9</div>
            <div>•</div>
            <div>Tailwind CSS 4.1</div>
            <div>•</div>
            <div>TanStack Query</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
