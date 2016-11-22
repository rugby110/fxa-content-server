/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern',
  'intern!object',
  'tests/lib/helpers',
  'tests/functional/lib/helpers',
  'app/scripts/lib/constants'
], function (intern, registerSuite, TestHelpers,
  FunctionalHelpers, Constants) {
  var FX_DESKTOP_V2_CONTEXT = Constants.FX_DESKTOP_V2_CONTEXT;

  var config = intern.config;

  // The automatedBrowser query param tells signin/up to stub parts of the flow
  // that require a functioning desktop channel
  var PAGE_SIGNIN = config.fxaContentRoot + 'signin';
  var PAGE_SIGNIN_DESKTOP = PAGE_SIGNIN + '?context=' + FX_DESKTOP_V2_CONTEXT + '&service=sync&forceAboutAccounts=true';
  var PAGE_SIGNIN_NO_CACHED_CREDS = PAGE_SIGNIN + '?email=blank';
  var PAGE_SIGNUP = config.fxaContentRoot + 'signup';
  var PAGE_SIGNUP_DESKTOP = config.fxaContentRoot + 'signup?context=' + FX_DESKTOP_V2_CONTEXT + '&service=sync';

  var PASSWORD = 'password';
  var email;
  var email2;

  var thenify = FunctionalHelpers.thenify;

  var clearBrowserState = FunctionalHelpers.clearBrowserState;
  var clearSessionStorage = thenify(FunctionalHelpers.clearSessionStorage);
  var click = FunctionalHelpers.click;
  var createUser = FunctionalHelpers.createUser;
  var fillOutSignIn = FunctionalHelpers.fillOutSignIn;
  var fillOutSignUp = FunctionalHelpers.fillOutSignUp;
  var openPage = FunctionalHelpers.openPage;
  var openVerificationLinkDifferentBrowser = thenify(FunctionalHelpers.openVerificationLinkDifferentBrowser);
  var respondToWebChannelMessage = FunctionalHelpers.respondToWebChannelMessage;
  var testElementExists = FunctionalHelpers.testElementExists;
  var testElementTextEquals = FunctionalHelpers.testElementTextEquals;
  var testElementValueEquals = FunctionalHelpers.testElementValueEquals;
  var testIsBrowserNotified = FunctionalHelpers.testIsBrowserNotified;
  var type = FunctionalHelpers.type;
  var visibleByQSA = FunctionalHelpers.visibleByQSA;

  registerSuite({
    name: 'sign_in cached',

    beforeEach: function () {
      email = TestHelpers.createEmail('sync{id}');
      email2 = TestHelpers.createEmail();
      return this.remote
        .then(clearBrowserState({ force: true }))
        .then(createUser(email, PASSWORD, { preVerified: true }))
        .then(createUser(email2, PASSWORD, { preVerified: true }));
    },

    'sign in twice, on second attempt email will be cached': function () {
      return this.remote
        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        .then(fillOutSignIn(email, PASSWORD))

        .then(testElementExists('#fxa-settings-header'))
        // reset prefill and context
        .then(clearSessionStorage(this))

        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        .then(type('input[type=password]', PASSWORD))
        .then(click('button[type="submit"]'))

        .then(testElementExists('#fxa-settings-header'));
    },

    'sign in first in sync context, on second attempt credentials will be cached': function () {
      return this.remote
        .then(openPage(PAGE_SIGNIN_DESKTOP, '#fxa-signin-header'))
        .then(respondToWebChannelMessage(this, 'fxaccounts:can_link_account', { ok: true } ))
        .then(fillOutSignIn(email, PASSWORD))

        .then(testIsBrowserNotified(this, 'fxaccounts:login'))
        .then(testElementExists('#fxa-confirm-signin-header'))
        .then(openVerificationLinkDifferentBrowser(email))

        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))

        .then(click('.use-logged-in'))
        .then(testElementExists('#fxa-settings-header'));
    },

    'sign in once, use a different account': function () {
      return this.remote
        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        .then(fillOutSignIn(email, PASSWORD))

        .then(testElementExists('#fxa-settings-header'))

        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        // testing to make sure "Use different account" button works
        .then(click('.use-different'))

        // the form should not be prefilled
        .then(testElementValueEquals('input[type=email]', ''))

        .then(fillOutSignIn(email2, PASSWORD))

        .then(testElementExists('#fxa-settings-header'))

        // testing to make sure cached signin comes back after a refresh
        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))

        .then(click('.use-different'))
        .then(testElementExists('input[type=email]'))

        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        .then(testElementValueEquals('input[type=email]', ''));
    },

    'sign in with cached credentials but with an expired session': function () {
      return this.remote
        .then(openPage(PAGE_SIGNIN_DESKTOP, '#fxa-signin-header'))
        .then(respondToWebChannelMessage(this, 'fxaccounts:can_link_account', { ok: true } ))
        .then(fillOutSignIn(email, PASSWORD))
        .then(testIsBrowserNotified(this, 'fxaccounts:login'))

        .execute(function () {
          var accounts = JSON.parse(localStorage.getItem('__fxa_storage.accounts'));
          var uid = Object.keys(accounts)[0];
          accounts[uid].sessionToken = 'eeead2b45791360e00b162ed37f118abbdae6ee8d3997f4eb48ee31dbdf53802';
          localStorage.setItem('__fxa_storage.accounts', JSON.stringify(accounts));
          return true;
        })

        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        .then(click('.use-logged-in'))

        // Session expired error should show.
        .then(visibleByQSA('.error'))

        .then(type('input.password', PASSWORD))
        .then(click('button[type="submit"]'))

        .then(testElementExists('#fxa-settings-header'));
    },

    'unverified cached signin with sync context redirects to confirm email': function () {
      var email = TestHelpers.createEmail();
      return this.remote
        .then(openPage(PAGE_SIGNUP_DESKTOP, '#fxa-signup-header'))
        .then(respondToWebChannelMessage(this, 'fxaccounts:can_link_account', { ok: true } ))
        .then(fillOutSignUp(email, PASSWORD))

        .then(testElementExists('#fxa-choose-what-to-sync-header'))
        .then(click('button[type="submit"]'))

        .then(testElementExists('#fxa-confirm-header'))
        // reset prefill and context
        .then(clearSessionStorage(this))

        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        // cached login should still go to email confirmation screen for unverified accounts
        .then(click('.use-logged-in'))

        .then(testElementExists('#fxa-confirm-header'));
    },

    'unverified cached signin redirects to confirm email': function () {
      var email = TestHelpers.createEmail();

      return this.remote
        .then(openPage(PAGE_SIGNUP, '#fxa-signup-header'))
        .then(fillOutSignUp(email, PASSWORD))

        .then(testElementExists('#fxa-confirm-header'))

        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        .then(type('input[type=password]', PASSWORD))
        .then(click('button[type="submit"]'))

        // cached login should still go to email confirmation screen for unverified accounts
        .then(testElementExists('#fxa-confirm-header'));
    },

    'sign in on desktop then sign in with prefill does not show picker': function () {
      return this.remote
        .then(openPage(PAGE_SIGNIN_DESKTOP, '#fxa-signin-header'))
        .then(respondToWebChannelMessage(this, 'fxaccounts:can_link_account', { ok: true } ))
        .then(fillOutSignIn(email, PASSWORD))
        .then(testIsBrowserNotified(this, 'fxaccounts:login'))
        .then(testElementExists('#fxa-confirm-signin-header'))

        .then(openPage(PAGE_SIGNIN + '?email=' + email2, '#fxa-signin-header'))
        /*.then(testElementValueEquals('input.email.prefilled', email2))*/
        .then(type('input[type=password]', PASSWORD))
        .then(click('button[type="submit"]'))

        .then(testElementExists('#fxa-settings-header'))

        // reset prefill and context
        .then(clearSessionStorage(this))

        // testing to make sure cached signin comes back after a refresh
        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        .then(testElementTextEquals('.prefillEmail', email))
        .then(click('.use-different'))

        .then(testElementExists('input[type=email]'));
    },

    'sign in with desktop context then no context, desktop credentials should not persist': function () {
      return this.remote
        .then(openPage(PAGE_SIGNIN_DESKTOP, '#fxa-signin-header'))
        .then(respondToWebChannelMessage(this, 'fxaccounts:can_link_account', { ok: true } ))
        .then(fillOutSignIn(email, PASSWORD))
        .then(testIsBrowserNotified(this, 'fxaccounts:login'))
        .then(testElementExists('#fxa-confirm-signin-header'))

        // ensure signin page is visible otherwise credentials might
        // not be cleared by clicking .use-different
        .then(openPage(PAGE_SIGNIN, '.use-different'))
        .then(visibleByQSA('#fxa-signin-header'))
        // This will clear the desktop credentials
        .then(click('.use-different'))
        // need to wait for the email field to be visible
        // before attempting to sign-in.
        .then(visibleByQSA('input[type=email]'))

        .then(fillOutSignIn(email2, PASSWORD))
        .then(testElementExists('#fxa-settings-header'))

        // reset prefill and context
        .then(clearSessionStorage(this))

        // testing to make sure cached signin comes back after a refresh
        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        .then(testElementTextEquals('.prefillEmail', email2))

        .refresh()

        .then(testElementExists('.use-different'))
        .then(testElementTextEquals('.prefillEmail', email2));
    },

    'overrule cached credentials': function () {
      return this.remote
        .then(openPage(PAGE_SIGNIN, '#fxa-signin-header'))
        .then(fillOutSignIn(email, PASSWORD))

        .then(testElementExists('#fxa-settings-header'))
        // reset prefill and context
        .then(clearSessionStorage(this))

        .then(openPage(PAGE_SIGNIN_NO_CACHED_CREDS, '#fxa-signin-header'))
        .then(fillOutSignIn(email, PASSWORD))

        .then(testElementExists('#fxa-settings-header'));
    }
  });
});
