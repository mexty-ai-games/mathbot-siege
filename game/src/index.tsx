(window as any).__MSB_DEBUG__ = true;
import { mount } from './App';
import props from './dev-props.json';
mount(document.getElementById('root')!, props);
