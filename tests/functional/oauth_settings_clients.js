/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern',
  'intern!object',
  'tests/lib/helpers',
  'tests/functional/lib/helpers'
], function (intern, registerSuite, TestHelpers, FunctionalHelpers) {
  var config = intern.config;
  var CONTENT_SERVER = config.fxaContentRoot;
  var APPS_SETTINGS_URL = CONTENT_SERVER + 'settings/clients?forceDeviceList=1';
  var UNTRUSTED_OAUTH_APP = config.fxaUntrustedOauthApp;

  var PASSWORD = 'password';
  var UNTRUSTED_OAUTH_WINDOW = 'untrusted';

  var thenify = FunctionalHelpers.thenify;
  var click = FunctionalHelpers.click;
  var clearBrowserState = FunctionalHelpers.clearBrowserState;
  var fillOutSignUp = FunctionalHelpers.fillOutSignUp;
  var getVerificationLink = thenify(FunctionalHelpers.getVerificationLink);
  var testElementExists = FunctionalHelpers.testElementExists;
  var openFxaFromRp = FunctionalHelpers.openFxaFromRp;
  var openPage = FunctionalHelpers.openPage;
  var pollUntilGoneByQSA = FunctionalHelpers.pollUntilGoneByQSA;
  var type = FunctionalHelpers.type;
  var closeCurrentWindow = FunctionalHelpers.closeCurrentWindow;

  var email;

  registerSuite({
    name: 'oauth settings clients',

    beforeEach: function () {
      email = TestHelpers.createEmail();

      return this.remote
        .then(clearBrowserState({
          '123done': true,
          contentServer: true
        }));
    },

    'rp listed in apps, can be deleted': function () {
      var self = this;
      self.timeout = 90 * 1000;

      return openFxaFromRp(this, 'signup')
        .then(fillOutSignUp(email, PASSWORD))
        .then(testElementExists('#fxa-confirm-header'))
        .then(getVerificationLink(email, 0))
        .then(function (verificationLink) {
          return this.parent
            .then(openPage(verificationLink, '#loggedin'));
        })

        // lists the first client
        .then(function () {
          return this.parent
            .then(openPage(APPS_SETTINGS_URL, '.client-disconnect'));
        })

        // sign in into another app
        .execute(function (UNTRUSTED_OAUTH_APP, UNTRUSTED_OAUTH_WINDOW) {
          window.open(UNTRUSTED_OAUTH_APP, UNTRUSTED_OAUTH_WINDOW);
        }, [UNTRUSTED_OAUTH_APP, UNTRUSTED_OAUTH_WINDOW])
        .switchToWindow(UNTRUSTED_OAUTH_WINDOW)

        .then(click('.signin'))
        .then(type('#password', PASSWORD))
        .then(click('#submit-btn'))

        .then(testElementExists('#fxa-permissions-header'))
        .then(click('#accept'))
        .then(testElementExists('#loggedin'))

        .then(closeCurrentWindow())

        // second app should show up using 'refresh'
        .then(click('.clients-refresh'))

        .then(testElementExists('li.client-oAuthApp:nth-child(2)'))

        // delete should work
        .then(click('li.client-oAuthApp:nth-child(1) .client-disconnect'))
        .then(click('li.client-oAuthApp:nth-child(2) .client-disconnect'))
        .then(pollUntilGoneByQSA('.client-disconnect'));
    }

  });

});
