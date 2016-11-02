/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Handles the marketing snippet on the 'ready' page.
 *
 * Shows `Get Sync on Firefox for Android` for users that complete
 * signup for sync in Firefox Desktop.
 */

define(function (require, exports, module) {
  'use strict';

  const BaseView = require('views/base');
  const Cocktail = require('cocktail');
  const Constants = require('lib/constants');
  const MarketingMixin = require('views/mixins/marketing-mixin');
  const Template = require('stache!templates/marketing_snippet');
  const VerificationReasonMixin = require('views/mixins/verification-reason-mixin');

  var View = BaseView.extend({
    template: Template,

    initialize (options) {
      options = options || {};

      this._service = options.service;
    },

    context () {
      var shouldShowMarketing = this._shouldShowSignUpMarketing();

      return {
        showSignUpMarketing: shouldShowMarketing
      };
    },

    _shouldShowSignUpMarketing () {
      var isFirefoxMobile = this._isFirefoxMobile();
      var isSignUp = this.isSignUp();
      var isSignIn = this.isSignIn();

      var isSync = this._service === Constants.SYNC_SERVICE;

      // If the user is completing a signup or signin for sync, ALWAYS
      // show the marketing snippet.
      return (isSignUp || isSignIn) && isSync && ! isFirefoxMobile;
    },

    _isFirefoxMobile () {
      // For UA information, see
      // https://developer.mozilla.org/docs/Gecko_user_agent_string_reference

      var ua = this.window.navigator.userAgent;

      // covers both B2G and Firefox for Android
      var isMobileFirefox = /Mobile/.test(ua) && /Firefox/.test(ua);
      var isTabletFirefox = /Tablet/.test(ua) && /Firefox/.test(ua);

      return isMobileFirefox || isTabletFirefox;
    }
  });

  Cocktail.mixin(
    View,
    VerificationReasonMixin
  );

  module.exports = View;
});


