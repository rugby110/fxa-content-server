/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const Account = require('models/account');
  const { assert } = require('chai');
  const AuthBroker = require('models/auth_brokers/base');
  const Backbone = require('backbone');
  const Constants = require('lib/constants');
  const p = require('lib/promise');
  const Relier = require('models/reliers/relier');
  const sinon = require('sinon');
  const Url = require('lib/url');
  const View = require('views/connect_another_device');
  const WindowMock = require('../../mocks/window');

  describe('views/connect_another_device', () => {
    let account;
    let broker;
    let model;
    let relier;
    let view;
    let windowMock;

    beforeEach(() => {
      account = new Account();

      relier = new Relier();
      broker = new AuthBroker( { relier });
      broker.setCapability('emailVerificationMarketingSnippet', true);

      model = new Backbone.Model({ account });
      windowMock = new WindowMock();

      view = new View({
        broker,
        model,
        relier,
        window: windowMock
      });
    });

    describe('render', () => {
      describe('with a user that is signed in', () => {
        beforeEach(() => {
          sinon.stub(account, 'isSignedIn', () => p(true));

          return view.render();
        });

        it('shows the marketing area', () => {
          assert.lengthOf(view.$('.marketing-area'), 1);
        });
      });

      describe('with a user that can sign in', () => {
        beforeEach(() => {
          account.set('email', 'testuser@testuser.com');
          sinon.stub(account, 'isSignedIn', () => p(false));
          sinon.stub(view, '_canSignIn', () => true);

          return view.render();
        });

        it('shows a sign in button with the appropriate link', () => {
          assert.lengthOf(view.$('#signin'), 1);
        });
      });

      describe('with a user that cannot sign in', () => {
        beforeEach(() => {
          sinon.stub(account, 'isSignedIn', () => p(false));
          sinon.stub(view, '_canSignIn', () => false);

          return view.render();
        });

        it('shows the marketing area', () => {
          assert.lengthOf(view.$('.marketing-area'), 1);
        });
      });
    });

    describe('_canSignIn', () => {
      it('returns `false` if user is signed in', () => {

      });

      it('returns `false` if not on Firefox', () => {

      });

      it('returns `false` if on Fx for iOS', () => {

      });

      it('returns `false` if < Fx 40', () => {

      });

      it('returns true if not signed in, are on Fx Desktop >= 40', () => {

      });

      it('returns true if not signed in, are on Fennec >= 40', () => {

      });
    });

    describe('_getSignInContext', () => {
      it('returns fx_fennec_v1 for fennec', () => {
        sinon.stub(view, '_getUap', () => {
          return { isAndroid: () => true };
        });

        assert.equal(view._getSignInContext(), Constants.FX_FENNEC_V1_CONTEXT);
      });

      it('returns fx_desktop_v3 for everyone else', () => {
        sinon.stub(view, '_getUap', () => {
          return { isAndroid: () => false };
        });
        assert.equal(view._getSignInContext(), Constants.FX_DESKTOP_V3_CONTEXT);
      });
    });

    describe('_getEscapedSignInUrl', () => {
      const CONTEXT = 'fx_desktop_v3';
      const ORIGIN = 'https://accounts.firefox.com';

      beforeEach(() => {
        windowMock.location.origin = ORIGIN;
      });

      describe('with email', () => {
        it('URL has email query param', () => {
          const escapedSignInUrl
            = view._getEscapedSignInUrl(CONTEXT, 'testuser@testuser.com');

          const search = escapedSignInUrl.split('?')[1];
          const params = Url.searchParams(search);

          assert.equal(params.context, CONTEXT);
          assert.equal(params.email, 'testuser@testuser.com');
          assert.equal(params.service, Constants.SYNC_SERVICE);
          assert.equal(params.utm_source, View.UTM_SOURCE); //eslint-disable-line camelcase

          const origin = Url.getOrigin(escapedSignInUrl);
          assert.equal(origin, ORIGIN);
        });
      });

      describe('without an email', () => {
        it('URL does not have email query param', () => {
          const escapedSignInUrl = view._getEscapedSignInUrl(CONTEXT);
          const search = escapedSignInUrl.split('?')[1];
          const params = Url.searchParams(search);
          assert.notProperty(params, 'email');
        });
      });
    });
  });
});
