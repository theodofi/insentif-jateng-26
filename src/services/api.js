import '../../portal-config.js';
import '../../portal-api.js';

const portalApi = window.portalApi;

if (!portalApi) {
    throw new Error('portal_api_unavailable');
}

export default portalApi;
