/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern',
  'intern!object',
  'tests/lib/helpers',
  'tests/functional/lib/helpers'
], function (intern, registerSuite, TestHelpers,
             FunctionalHelpers) {
  var config = intern.config;

  var PASSWORD = 'password';
  var RESET_PASSWORD_URL = config.fxaContentRoot + 'reset_password?context=fx_desktop_v2&service=sync';

  var email;

  var thenify = FunctionalHelpers.thenify;

  var click = FunctionalHelpers.click;
  var clearBrowserState = FunctionalHelpers.clearBrowserState;
  var closeCurrentWindow = FunctionalHelpers.closeCurrentWindow;
  var createUser = FunctionalHelpers.createUser;
  var fillOutResetPassword = FunctionalHelpers.fillOutResetPassword;
  var fillOutCompleteResetPassword = thenify(FunctionalHelpers.fillOutCompleteResetPassword);
  var noSuchBrowserNotification = FunctionalHelpers.noSuchBrowserNotification;
  var openPage = FunctionalHelpers.openPage;
  var openVerificationLinkInNewTab = thenify(FunctionalHelpers.openVerificationLinkInNewTab);
  var testElementExists = FunctionalHelpers.testElementExists;
  var testElementTextInclude = FunctionalHelpers.testElementTextInclude;
  var testIsBrowserNotified = FunctionalHelpers.testIsBrowserNotified;
  var testSuccessWasShown = FunctionalHelpers.testSuccessWasShown;

  registerSuite({
    name: 'Firefox Desktop Sync v2 reset password',

    beforeEach: function () {
      // timeout after 90 seconds
      this.timeout = 90000;

      email = TestHelpers.createEmail();
      return this.remote.then(clearBrowserState());
    },

    teardown: function () {
      // clear localStorage to avoid polluting other tests.
      return this.remote.then(clearBrowserState());
    },

    'reset password, verify same browser': function () {
      return this.remote
        .then(openPage(RESET_PASSWORD_URL, '#fxa-reset-password-header'))
        .then(createUser(email, PASSWORD, { preVerified: true }))
        .then(fillOutResetPassword(email))

        .then(testElementExists('#fxa-confirm-reset-password-header'))
        .then(openVerificationLinkInNewTab(this, email, 0))

        .switchToWindow('newwindow')

        .then(testElementExists('#fxa-complete-reset-password-header'))
        .then(fillOutCompleteResetPassword(this, PASSWORD, PASSWORD))

        .then(testElementExists('#fxa-reset-password-complete-header'))
        .then(testElementTextInclude('.account-ready-service', 'Firefox Sync'))

        // the verification tab sends the WebChannel message. This fixes
        // two problems: 1) initiating tab is closed, 2) The initiating
        // tab when running in E10s does not have all the necessary data
        // because localStorage is not shared.
        .then(testIsBrowserNotified(this, 'fxaccounts:login'))

        .then(closeCurrentWindow())

        .then(testSuccessWasShown(this))
        .then(noSuchBrowserNotification(this, 'fxaccounts:login'));
    },

    'reset password with a restmail address, get the open webmail button': function () {
      this.timeout = 90000;

      return this.remote
        .then(openPage(RESET_PASSWORD_URL, '#fxa-reset-password-header'))
        .then(createUser(email, PASSWORD, { preVerified: true } ))
        .then(fillOutResetPassword(email))

        .then(testElementExists('#fxa-confirm-reset-password-header'))
        .then(click('[data-webmail-type="restmail"]'))

        .getAllWindowHandles()
          .then(function (handles) {
            return this.parent.switchToWindow(handles[1]);
          })

          // wait until url is correct
        .then(FunctionalHelpers.pollUntil(function (email) {
          return window.location.pathname.endsWith(email);
        }, [email], 10000))
        .then(closeCurrentWindow())

        .then(testElementExists('#fxa-confirm-reset-password-header'));
    }
  });

});
