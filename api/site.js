import {createVercelHandler} from '../server/vercel.js';

// As páginas e a API compartilham a mesma implementação do site.
export default {fetch:createVercelHandler()};
