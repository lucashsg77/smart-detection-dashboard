import * as React from 'react';
import MainPage from './pages/MainPage';

console.log('App.tsx loaded');

const App: React.FC = () => {
  console.log('Rendering App');
  return <MainPage />;
};

export default App;
