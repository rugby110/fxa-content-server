/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const Account = require('models/account');
  const { assert } = require('chai');
  const AuthBroker = require('models/auth_brokers/base');
  const Backbone = require('backbone');
  const p = require('lib/promise');
  const Relier = require('models/reliers/relier');
  const sinon = require('sinon');
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
    });

    describe('_getEscapedSignInUrl', () => {
    });
  });
});
