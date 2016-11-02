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
  var ADJUST_LINK_ANDROID = '<< UPDATE ME! >>>';
  var ADJUST_LINK_IOS = '<< UPDATE ME! >>>';

  var PAGE_ENTRYPOINTS = {
    'android_chrome': 'forceEntrypoint=android_chrome',
    'android_firefox': 'forceEntrypoint=android_firefox',
    'desktop_diff': 'forceEntrypoint=desktop_diff',
    'desktop_same': 'forceEntrypoint=desktop_same',
    'ios': 'forceEntrypoint=ios',
    'ios_firefox': 'forceEntrypoint=ios_firefox'
  };

  var PAGE_URL = config.fxaContentRoot + 'connect_another_device?';

  var SELECTOR_SIGNIN_HEADER = '#fxa-signin-header';
  var SELECTOR_CONTINUE_BUTTON = 'form div a';
  var SELECTOR_MARKETING_LINK_ANDROID = '.marketing-link-android';
  var SELECTOR_MARKETING_LINK_IOS = '.marketing-link-ios';
  var SELECTOR_PAGE_LOADED = '.graphic-connect-another-device';
  var SIGNIN_URL = config.fxaContentRoot + 'signin?';
  var SIGNUP_URL = config.fxaContentRoot + 'signup?';
  var SYNC_CONTEXT_DESKTOP = 'context=fx_desktop_v3&service=sync';
  var SYNC_CONTEXT_ANDROID = 'context=fx_fennec_v1&service=sync';

  var thenify = FunctionalHelpers.thenify;
  var clearBrowserState = FunctionalHelpers.clearBrowserState;
  var click = FunctionalHelpers.click;
  var fillOutSignUp = thenify(FunctionalHelpers.fillOutSignUp);
  var noSuchElement = thenify(FunctionalHelpers.noSuchElement);
  var openPage = thenify(FunctionalHelpers.openPage);
  var openVerificationLinkInSameTab = FunctionalHelpers.openVerificationLinkInSameTab;
  var respondToWebChannelMessage = FunctionalHelpers.respondToWebChannelMessage;
  var testElementExists = FunctionalHelpers.testElementExists;
  var testElementValueEquals = FunctionalHelpers.testElementValueEquals;
  var testLinkUrl = FunctionalHelpers.testLinkUrl;
  var testUrlEquals = FunctionalHelpers.testUrlEquals;

  var email;
  var PASSWORD = '12345678';

  registerSuite({
    name: 'Connect this Firefox',

    beforeEach: function () {
      email = TestHelpers.createEmail('sync{id}');

      return this.remote.then(clearBrowserState());
    },

    'desktop Firefox - same browser': function () {
      // should have both links to mobile apps
      return this.remote
        .then(openPage(this, SIGNUP_URL + SYNC_CONTEXT_DESKTOP, '#fxa-signup-header'))
        .then(respondToWebChannelMessage(this, 'fxaccounts:can_link_account', { ok: true } ))
        // this tests needs to sign up so that we can check if the email gets prefilled
        .then(fillOutSignUp(this, email, PASSWORD))
        .then(testElementExists('#fxa-choose-what-to-sync-header'))
        .then(click('button[type=submit]'))

        .then(testElementExists('#fxa-confirm-header'))
        .then(openVerificationLinkInSameTab(email, 0, {
          urlExtras: PAGE_ENTRYPOINTS['desktop_same']
        }))

        .then(testElementExists(SELECTOR_PAGE_LOADED))
        .then(noSuchElement(SELECTOR_CONTINUE_BUTTON))
        .then(testLinkUrl(SELECTOR_MARKETING_LINK_IOS, ADJUST_LINK_IOS))
        .then(testLinkUrl(SELECTOR_MARKETING_LINK_ANDROID, ADJUST_LINK_ANDROID));
    },

    'desktop Firefox - different browser': function () {
      // should sign in to sync here
      return this.remote
        .then(openPage(this, SIGNUP_URL + SYNC_CONTEXT_DESKTOP, '#fxa-signup-header'))
        .then(respondToWebChannelMessage(this, 'fxaccounts:can_link_account', { ok: true } ))
        // this tests needs to sign up so that we can check if the email gets prefilled
        .then(fillOutSignUp(this, email, PASSWORD))
        .then(testElementExists('#fxa-choose-what-to-sync-header'))
        .then(click('button[type=submit]'))

        .then(testElementExists('#fxa-confirm-header'))
        .then(openVerificationLinkInSameTab(email, 0, {
          urlExtras: PAGE_ENTRYPOINTS['desktop_diff']
        }))
        .then(click(SELECTOR_CONTINUE_BUTTON))
        .then(testElementExists(SELECTOR_SIGNIN_HEADER))
        .then(testElementValueEquals('input[type=email]', email))
        .then(testUrlEquals(SIGNIN_URL + SYNC_CONTEXT_DESKTOP));
    },

    'android Firefox': function () {
      // should navigate to sign in and have the email prefilled
      return this.remote
        .then(openPage(this, SIGNUP_URL + SYNC_CONTEXT_DESKTOP, '#fxa-signup-header'))
        .then(respondToWebChannelMessage(this, 'fxaccounts:can_link_account', { ok: true } ))
        // this tests needs to sign up so that we can check if the email gets prefilled
        .then(fillOutSignUp(this, email, PASSWORD))
        .then(testElementExists('#fxa-choose-what-to-sync-header'))
        .then(click('button[type=submit]'))

        .then(testElementExists('#fxa-confirm-header'))
        .then(openVerificationLinkInSameTab(email, 0, {
          urlExtras: PAGE_ENTRYPOINTS['android']
        }))
        .then(click(SELECTOR_CONTINUE_BUTTON))
        .then(testElementExists(SELECTOR_SIGNIN_HEADER))
        .then(testElementValueEquals('input[type=email]', email))
        .then(testUrlEquals(SIGNIN_URL + SYNC_CONTEXT_ANDROID));
    },

    'android Chrome': function () {
      // should show adjust Google badge
      return this.remote
        .then(openPage(this, PAGE_URL + PAGE_ENTRYPOINTS['android_chrome'], SELECTOR_PAGE_LOADED))
        .then(noSuchElement(SELECTOR_CONTINUE_BUTTON))
        .then(noSuchElement(SELECTOR_MARKETING_LINK_IOS))
        .then(testLinkUrl(SELECTOR_MARKETING_LINK_ANDROID, ADJUST_LINK_ANDROID));
    },

    'ios Safari': function () {
      // should show adjust iTunes badge and adjust link
      return this.remote
        .then(openPage(this, PAGE_URL, SELECTOR_PAGE_LOADED))
        .then(noSuchElement(SELECTOR_CONTINUE_BUTTON))
        .then(noSuchElement(SELECTOR_MARKETING_LINK_ANDROID))
        .then(testLinkUrl(SELECTOR_MARKETING_LINK_IOS, ADJUST_LINK_IOS));
    }
  });
});
