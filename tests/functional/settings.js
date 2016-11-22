/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern',
  'intern!object',
  'intern/chai!assert',
  'tests/lib/helpers',
  'tests/functional/lib/helpers'
], function (intern, registerSuite, assert, TestHelpers, FunctionalHelpers) {

  var config = intern.config;
  var SIGNIN_URL = config.fxaContentRoot + 'signin';
  var SETTINGS_URL = config.fxaContentRoot + 'settings';

  var thenify = FunctionalHelpers.thenify;

  var clearBrowserState = FunctionalHelpers.clearBrowserState;
  var click = FunctionalHelpers.click;
  var closeCurrentWindow = FunctionalHelpers.closeCurrentWindow;
  var createUser = FunctionalHelpers.createUser;
  var fillOutSignIn = FunctionalHelpers.fillOutSignIn;
  var focus = FunctionalHelpers.focus;
  var getFxaClient = FunctionalHelpers.getFxaClient;
  var openPage = FunctionalHelpers.openPage;
  var openSettingsInNewTab = thenify(FunctionalHelpers.openSettingsInNewTab);
  var testElementExists = FunctionalHelpers.testElementExists;
  var testErrorTextInclude = FunctionalHelpers.testErrorTextInclude;

  var FIRST_PASSWORD = 'password';
  var email;
  var accountData;

  registerSuite({
    name: 'settings',

    beforeEach: function () {
      email = TestHelpers.createEmail();

      return this.remote
        .then(createUser(email, FIRST_PASSWORD, { preVerified: true }))
        .then(function (result) {
          accountData = result;
        })
        .then(clearBrowserState());
    },

    afterEach: function () {
      return this.remote.then(clearBrowserState());
    },

    'with an invalid email': function () {
      return this.remote
        .then(openPage(SETTINGS_URL + '?email=invalid', '#fxa-400-header'))
        .then(testErrorTextInclude('invalid'))
        .then(testErrorTextInclude('email'));
    },

    'with an empty email': function () {
      return this.remote
        .then(openPage(SETTINGS_URL + '?email=', '#fxa-400-header'))
        .then(testErrorTextInclude('invalid'))
        .then(testErrorTextInclude('email'));
    },

    'with an invalid uid': function () {
      return this.remote
        .then(openPage(SETTINGS_URL + '?uid=invalid', '#fxa-400-header'))
        .then(testErrorTextInclude('invalid'))
        .then(testErrorTextInclude('uid'));
    },

    'with an empty uid': function () {
      return this.remote
        .then(openPage(SETTINGS_URL + '?uid=', '#fxa-400-header'))
        .then(testErrorTextInclude('invalid'))
        .then(testErrorTextInclude('uid'));
    },

    'sign in, go to settings, sign out': function () {
      return this.remote
        .then(openPage(SIGNIN_URL, '#fxa-signin-header'))
        .then(fillOutSignIn(email, FIRST_PASSWORD))

        .findByCssSelector('#fxa-settings-header')
        .end()

        // sign the user out
        .findById('signout')
          .click()
        .end()

        // success is going to the signin page
        .findById('fxa-signin-header')
        .end();
    },

    'sign in, go to settings with setting param set to avatar redirects to avatar change page ': function () {
      return this.remote
        .then(fillOutSignIn(email, FIRST_PASSWORD, true))

        .findById('fxa-settings-header')
        .end()

        .then(openPage(SETTINGS_URL + '?setting=avatar', '#avatar-options'))

        .findByCssSelector('.modal-panel button.cancel')
          .click()
        .end()

        // Should not redirect after clicking the home button
        .findById('fxa-settings-header')
        .end();
    },

    'sign in, go to settings with setting param and additional params redirects to avatar change page ': function () {
      return this.remote
        .then(fillOutSignIn(email, FIRST_PASSWORD, true))

        .findById('fxa-settings-header')
        .end()

        .then(openPage(SETTINGS_URL + '?setting=avatar&uid=' + accountData.uid, '#avatar-options'))

        .findByCssSelector('.modal-panel button.cancel')
          .click()
        .end()

        // Should not redirect after clicking the home button
        .findById('fxa-settings-header')
        .end();
    },

    'sign in with setting param set to avatar redirects to avatar change page ': function () {
      return this.remote
        .then(openPage(SIGNIN_URL + '?setting=avatar', '#fxa-signin-header'))
        .then(fillOutSignIn(email, FIRST_PASSWORD))
        .findById('avatar-options')
        .end();
    },

    'sign in with setting param and additional params redirects to avatar change page ': function () {
      return this.remote
        .then(openPage(SIGNIN_URL + '?setting=avatar&uid=' + accountData.uid, '#fxa-signin-header'))
        .then(fillOutSignIn(email, FIRST_PASSWORD))
        .findById('avatar-options')
        .end();
    },

    'sign in, go to settings and opening display_name panel autofocuses the first input element': function () {
      return this.remote
        .then(fillOutSignIn(email, FIRST_PASSWORD, true))
        .findByCssSelector('[data-href="settings/display_name"]')
          .click()
        .end()
        .findByCssSelector('input.display-name')
        .end()
        .getActiveElement()
        .then(function (element) {
          element.getAttribute('class')
            .then(function (className) {
              assert.isTrue(className.includes('display-name'));
            });
        })
        .end();
    },

    'sign in, open settings in a second tab, sign out': function () {
      var windowName = 'sign-out inter-tab functional test';
      return this.remote
        .then(fillOutSignIn(email, FIRST_PASSWORD))
        // wait for the settings page or else when the new tab is opened,
        // the user is asked to sign in.
        .then(testElementExists('#fxa-settings-header'))

        .then(openSettingsInNewTab(this, windowName))
        .switchToWindow(windowName)
        .then(testElementExists('#fxa-settings-header'))
        .then(click('#signout'))

        .then(testElementExists('#fxa-signin-header'))
        .then(closeCurrentWindow())

        .then(testElementExists('#fxa-signin-header'));
    }
  });

  registerSuite({
    name: 'settings unverified',

    beforeEach: function () {
      email = TestHelpers.createEmail();

      return this.remote
        .then(createUser(email, FIRST_PASSWORD))
        .then(clearBrowserState())
        .then(fillOutSignIn(email, FIRST_PASSWORD))

        .then(testElementExists('#fxa-confirm-header'));
    },

    'visit settings page with an unverified account redirects to confirm': function () {
      return this.remote
        // Expect to get redirected to confirm since the account is unverified
        .then(openPage(SETTINGS_URL, '#fxa-confirm-header'));
    }
  });

  registerSuite({
    name: 'settings with expired session',

    beforeEach: function () {
      email = TestHelpers.createEmail();

      return this.remote
        .then(createUser(email, FIRST_PASSWORD, { preVerified: true }))
        .then(clearBrowserState({ force: true }))
        .then(fillOutSignIn(email, FIRST_PASSWORD))

        .then(testElementExists('#fxa-settings-header'))
        .execute(function () {
          // get the first (and only) stored account data, we want to destroy
          // the session.
          var accounts = JSON.parse(localStorage.getItem('__fxa_storage.accounts')) || {};
          var firstKey = Object.keys(accounts)[0];
          return accounts[firstKey];
        })
        .then(function (accountData) {
          return getFxaClient().sessionDestroy(accountData.sessionToken);
        });
    },

    afterEach: function () {
      // browser state must be cleared or the tests that follow fail.
      return this.remote
        .then(clearBrowserState({ force: true }));
    },

    'a focus on the settings page after session expires redirects to signin': function () {
      return this.remote
        .then(focus())

        .then(testElementExists('#fxa-signin-header'));
    }
  });
});
