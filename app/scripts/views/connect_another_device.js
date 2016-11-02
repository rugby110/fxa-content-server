/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * If the user verifies their email in an instance of Firefox
 * that other than the one they used to sign up, suggest
 * that they sign in.
 */
define(function (require, exports, module) {
  'use strict';

  const Cocktail = require('cocktail');
  const Constants = require('lib/constants');
  const FormView = require('views/form');
  const Template = require('stache!templates/connect_another_device');
  const MarketingMixin = require('views/mixins/marketing-mixin');
  const UserAgent = require('lib/user-agent');
  const Url = require('lib/url');

  const View = FormView.extend({
    template: Template,

    beforeRender () {
      return this.getAccount().isSignedIn()
        .then((isSignedIn) => {
          this.model.set('isSignedIn', isSignedIn);
        });
    },

    getAccount () {
      if (! this.model.get('account')) {
        this.model.set('account', this.user.initAccount({}));
      }

      return this.model.get('account');
    },

    context () {
      return {
        canSignIn: this._canSignIn(),
        email: this._getEmail(),
        escapedSignInUrl: this._getEscapedSignInUrl(),
        escapedSupportUrl: encodeURI(this._getSupportUrl())
      };
    },

    _getUap () {
      if (! this._uap) {
        this._uap = new UserAgent(this.window.navigator.userAgent);
      }
      return this._uap;
    },

    _canSignIn () {
      const uap = this._getUap();
               // Only users that are not signed in can do so.
      return ! this.model.get('isSignedIn') &&
               // All Foxes >= 40 except iOS can sign in.
               uap.isFirefox() &&
             ! uap.isIos() &&
               uap.browser.version >= 40;
    },

    _getSignInContext() {
      const uap = this._getUap();
      if (uap.isAndroid()) {
        return Constants.FX_FENNEC_V1_CONTEXT;
      } else {
        // desktop_v3 is safe for all desktop versions that can use
        // WebChannels. The only difference between v2 and v3 was the Sync
        // Preferences button, which has since been disabled.
        return Constants.FX_DESKTOP_V3_CONTEXT;
      }
    },

    _getSupportUrl () {
      return 'https://support.mozilla.org';
    },

    _getEscapedSignInUrl () {
      const origin = this.window.location.origin;

      const params = {
        context: this._getSignInContext(),
        email: this._getEmail(),
        service: Constants.SYNC_SERVICE,
        utm_source: 'connect_another_device' //eslint-disable-line camelcase
      };
      // Url.objToSearchString escapes each of the query parameters.
      const escapedSearchString = Url.objToSearchString(params);

      return `${origin}/signin${escapedSearchString}`;
    },

    _getEmail () {
      return this.getAccount().get('email');
    }
  });

  Cocktail.mixin(
    View,
    MarketingMixin
  );

  module.exports = View;
});
