/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const OAuthErrors = require('lib/oauth-errors');
  const xhr = require('lib/xhr');

  const CLIENT_TOKENS_API = '/v1/client-tokens';
  const DESTROY_TOKEN = '/v1/destroy';
  const GET_CLIENT = '/v1/client/';
  const GET_CODE = '/v1/authorization';

  function OAuthClient(options) {
    options = options || {};

    this._oAuthUrl = options.oAuthUrl;
    this._xhr = options.xhr || xhr;
  }

  OAuthClient.prototype = {
    _request (method, endpoint, params) {
      return this._xhr[method](this._oAuthUrl + endpoint, params || null)
        .fail(function (xhr) {
          var err = OAuthErrors.normalizeXHRError(xhr);
          throw err;
        });
    },

    /**
     *
     * @param {Object} params
     * @param {String} params.assertion
     * @param {String} params.client_id
     * @param {String} params.redirect_uri
     * @param {String} params.scope
     * @param {String} params.state
     * @returns {Promise}
     */
    getCode: function getCode(params) {
      return this._request('post', GET_CODE, params);
    },

    getClientInfo: function getClientInfo(id) {
      return this._request('get', GET_CLIENT + id);
    },

    /**
     * Fetch user's active OAuth clients
     *
     * @param {String} accessToken
     * @returns {Promise}
     */
    fetchOAuthApps (accessToken) {
      const request = {
        accessToken: accessToken,
        type: 'get',
        url: `${this._oAuthUrl}${CLIENT_TOKENS_API}`
      };

      return this._xhr.oauthAjax(request);
    },

    /**
     * Delete all active OAuth tokens for given clientId
     *
     * @param {String} accessToken
     * @param {String} clientId
     * @returns {Promise}
     */
    destroyOAuthApp (accessToken, clientId) {
      const request = {
        accessToken: accessToken,
        type: 'delete',
        url: `${this._oAuthUrl}${CLIENT_TOKENS_API}/${clientId}`
      };

      return this._xhr.oauthAjax(request);
    },

    /**
     *
     * @param {Object} params
     * @param {String} params.assertion
     * @param {String} params.client_id
     * @param {String} params.scope
     * @param {String} params.response_type
     * @param {String} [params.ttl]
     * @returns {Promise}
     */
    getToken (params = {}) {
      // set authorization TTL to 5 minutes.
      // Docs: github.com/mozilla/fxa-oauth-server/blob/master/docs/api.md#post-v1authorization
      // Issue: #3982
      params.ttl = params.ttl || '300';
      // Use the special 'token' response type
      params.response_type = 'token'; //eslint-disable-line camelcase
      return this.getCode(params);
    },

    destroyToken: function destroyToken(token) {
      var params = {
        token: token
      };

      return this._request('post', DESTROY_TOKEN, params);
    }
  };

  module.exports = OAuthClient;
});

