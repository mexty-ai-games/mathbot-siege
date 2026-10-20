import React from 'react';
import ReactDOM from 'react-dom/client';
import {Block} from "./block";
import './styles.css';

export function mount(container: HTMLElement, initialProps?: any) {
  const root = ReactDOM.createRoot(container);
  root.render(<Block {...(initialProps || {})} />);
  return { unmount: () => root.unmount() };
}
export default mount;
