(window as any).__MSB_DEBUG__ = true;
import { mount } from './App';
import { setupShots } from './dev-shots';
import props from './dev-props.json';
setupShots();
mount(document.getElementById('root')!, props);
