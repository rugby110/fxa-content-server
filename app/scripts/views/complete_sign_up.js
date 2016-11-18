/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Complete sign up is used to complete the email verification for one
 * of three types of users:
 *
 * 1. New users that just signed up.
 * 2. Existing users that have signed in with an unverified account.
 * 3. Existing users that are signing into Sync and
 *    must re-confirm their account.
 *
 * The auth server endpoints that are called are the same in all cases.
 */

define(function (require, exports, module) {
  'use strict';

  const AuthErrors = require('lib/auth-errors');
  const BaseView = require('views/base');
  const Cocktail = require('cocktail');
  const CompleteSignUpTemplate = require('stache!templates/complete_sign_up');
  const ExperimentMixin = require('views/mixins/experiment-mixin');
  const MarketingEmailErrors = require('lib/marketing-email-errors');
  const ResendMixin = require('views/mixins/resend-mixin');
  const ResumeTokenMixin = require('views/mixins/resume-token-mixin');
  const VerificationInfo = require('models/verification/sign-up');
  const VerificationReasonMixin = require('views/mixins/verification-reason-mixin');

  const t = BaseView.t;

  const CompleteSignUpView = BaseView.extend({
    template: CompleteSignUpTemplate,
    className: 'complete_sign_up',

    initialize (options = {}) {
      this._verificationInfo = new VerificationInfo(this.getSearchParams());
      var uid = this._verificationInfo.get('uid');

      var account = options.account || this.user.getAccountByUid(uid);
      // the account will not exist if verifying in a second browser, and the
      // default account will be returned. Add the uid to the account so
      // verification can still occur.
      if (account.isDefault()) {
        account.set('uid', uid);
      }

      this._account = account;

      // cache the email in case we need to attempt to resend the
      // verification link
      this._email = this._account.get('email');
    },

    getAccount () {
      return this._account;
    },

    _navigateToVerifiedScreen () {
      if (this.isSignUp()) {
        this.navigate('signup_verified');
      } else {
        this.navigate('signin_verified');
      }
    },

    beforeRender () {
      const verificationInfo = this._verificationInfo;
      if (! verificationInfo.isValid()) {
        // One or more parameters fails validation. Abort and show an
        // error message before doing any more checks.
        this.logError(AuthErrors.toError('DAMAGED_VERIFICATION_LINK'));
        return true;
      }

      const account = this.getAccount();
      account.populateFromStringifiedResumeToken(this.getSearchParam('resume'));
      const code = verificationInfo.get('code');
      const options = {
        reminder: verificationInfo.get('reminder'),
        service: this.relier.get('service')
      };
      return this.user.completeAccountSignUp(account, code, options)
          .fail((err) => {
            if (MarketingEmailErrors.created(err)) {
              // A basket error should not prevent the
              // sign up verification from completing, nor
              // should an error be displayed to the user.
              // Log the error and nothing else.
              this.logError(err);
            } else {
              throw err;
            }
          })
          .then(() => {
            this.logViewEvent('verification.success');
            this.notifier.trigger('verification.success');

            // Update the stored account data in case it was
            // updated by verifySignUp.
            var account = this.getAccount();
            this.user.setAccount(account);
            return this.invokeBrokerMethod('afterCompleteSignUp', account);
          })
          .then(() => {
            var account = this.getAccount();

            if (this.relier.isSync()) {
              if (this.isInExperimentGroup('connectAnotherDevice', 'treatment')) {
                // Sync users that are part of the experiment group who verify
                // are sent to "connect another device". If the experiment proves
                // useful, all users will be sent there.
                this.navigate('connect_another_device', { account });
              } else {
                this._navigateToVerifiedScreen();
              }
              return false;
            } else if (this.relier.isOAuth()) {
              // If an OAuth user makes it here, they are either not signed in
              // or are verifying in a different tab. Show the "Account
              // verified!" screen to the user, the correct tab will have
              // already transitioned back to the relier.
              this._navigateToVerifiedScreen();
            } else if (this.relier.isSync()) {
              // All sync verifiers are sent to "connect another device." We
              // want more multi-device users!
              this.navigate('connect_another_device', { account });
            } else {
              return account.isSignedIn()
                .then((isSignedIn) => {
                  if (isSignedIn) {
                    this.navigate('settings', {
                      success: t('Account verified successfully')
                    });
                  } else {
                    this._navigateToVerifiedScreen();
                  }
                });
            }
          })
          .fail((err) => {
            if (AuthErrors.is(err, 'UNKNOWN_ACCOUNT')) {
              verificationInfo.markExpired();
              err = AuthErrors.toError('UNKNOWN_ACCOUNT_VERIFICATION');
            } else if (
                AuthErrors.is(err, 'INVALID_VERIFICATION_CODE') ||
                AuthErrors.is(err, 'INVALID_PARAMETER')) {

              // When coming from sign-in confirmation verification, show a
              // verification link expired error instead of damaged verification link.
              // This error is generated because the link has already been used.
              if (this.isSignIn()) {
                // Disable resending verification, can only be triggered from new sign-in
                verificationInfo.markUsed();
                err = AuthErrors.toError('REUSED_SIGNIN_VERIFICATION_CODE');
              } else {
                // These server says the verification code or any parameter is
                // invalid. The entire link is damaged.
                verificationInfo.markDamaged();
                err = AuthErrors.toError('DAMAGED_VERIFICATION_LINK');
              }
            } else {
              // all other errors show the standard error box.
              this.model.set('error', err);
            }

            this.logError(err);
            return true;
          });
    },

    context () {
      var verificationInfo = this._verificationInfo;
      return {
        canResend: this._canResend(),
        error: this.model.get('error'),
        // If the link is invalid, print a special error message.
        isLinkDamaged: ! verificationInfo.isValid(),
        isLinkExpired: verificationInfo.isExpired(),
        isLinkUsed: verificationInfo.isUsed()
      };
    },

    _canResend () {
      // _getResendSessionToken is only returned if the user signed up in the
      // same browser in which they opened the verification link.
      return !! this._getResendSessionToken() && this.isSignUp();
    },

    // This returns the latest sessionToken associated with the user's email
    // address. We intentionally don't cache it during view initialization so that
    // we can capture sessionTokens from accounts created (in this browser)
    // since the view was loaded.
    _getResendSessionToken () {
      return this.user.getAccountByEmail(this._email).get('sessionToken');
    },

    // This is called when a user follows an expired verification link
    // and clicks the "Resend" link.
    resend () {
      var account = this.user.getAccountByEmail(this._email);
      return account.retrySignUp(this.relier, {
        resume: this.getStringifiedResumeToken(account)
      })
      .fail((err) => {
        if (AuthErrors.is(err, 'INVALID_TOKEN')) {
          return this.navigate('signup', {
            error: err
          });
        }

        // unexpected error, rethrow for display.
        throw err;
      });
    }
  });

  Cocktail.mixin(
    CompleteSignUpView,
    ExperimentMixin,
    ResendMixin,
    ResumeTokenMixin,
    VerificationReasonMixin
  );

  module.exports = CompleteSignUpView;
});
