/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const Able = require('lib/able');
  const chai = require('chai');
  const VerificationReasons = require('lib/verification-reasons');
  const FxaClient = require('lib/fxa-client');
  const OAuthBroker = require('models/auth_brokers/oauth');
  const p = require('lib/promise');
  const Session = require('lib/session');
  const sinon = require('sinon');
  const SyncRelier = require('models/reliers/sync');
  const View = require('views/ready');
  const WindowMock = require('../../mocks/window');

  var assert = chai.assert;

  describe('views/ready', function () {
    var view;
    var windowMock;
    var fxaClient;
    var relier;
    var broker;
    var able;
    var metrics;

    function createDeps() {
      windowMock = new WindowMock();
      relier = new SyncRelier({
        window: windowMock
      });
      broker = new OAuthBroker({
        relier: relier,
        session: Session,
        window: windowMock
      });
      fxaClient = new FxaClient();

      able = new Able();
      metrics = {
        flush: sinon.spy(p),
        logMarketingImpression () {}
      };
    }

    function createView(type, lang) {
      view = new View({
        able: able,
        broker: broker,
        fxaClient: fxaClient,
        lang: lang,
        metrics: metrics,
        relier: relier,
        type: type,
        window: windowMock
      });
    }

    describe('render', function () {
      beforeEach(function () {
        createDeps();
      });

      afterEach(function () {
        view.remove();
        view.destroy();
      });

      var expectedHeaders = {
        FORCE_AUTH: '#fxa-force-auth-complete-header',
        PASSWORD_RESET: '#fxa-reset-password-complete-header',
        SIGN_IN: '#fxa-sign-in-complete-header',
        SIGN_UP: '#fxa-sign-up-complete-header'
      };

      for (var type in expectedHeaders) {
        it('renders the correct header for `' + type + '`', function (type) {
          createView(VerificationReasons[type]);
          return view.render()
            .then(function () {
              assert.ok(view.$(expectedHeaders[type]).length);
            });
        }.bind(null, type));
      }

      it('shows service name if available', function () {
        createView(VerificationReasons.SIGN_UP);
        relier.set('serviceName', 'Firefox Sync');

        return view.render()
          .then(function () {
            var html = view.$('section').text();
            assert.include(html, 'Firefox Sync');
          });
      });

      // regression test for #1216
      it('does not show service name if service is defined but serviceName is not', function () {
        createView(VerificationReasons.SIGN_UP);
        view.context = function () {
          return {
            service: 'sync'
          };
        };

        return view.render()
          .then(function () {
            assert.ok(view.$('.account-ready-generic').length);
          });
      });

      it('shows the marketing campaign if supported by broker', function () {
        sinon.stub(able, 'choose', () => true);
        sinon.stub(broker, 'hasCapability', (type) => {
          if (type === 'emailVerificationMarketingSnippet') {
            return true;
          }
        });

        relier.set('service', 'sync');
        createView(VerificationReasons.SIGN_UP);

        return view.render()
          .then(function () {
            assert.ok(view.$('.marketing-link').length);
          });
      });

      it('does not show marketing if the broker does not support it', function () {
        sinon.stub(broker, 'hasCapability', function (type) {
          if (type === 'emailVerificationMarketingSnippet') {
            return false;
          }
        });

        createView(VerificationReasons.SIGN_UP);

        return view.render()
          .then(function () {
            assert.equal(view.$('.marketing').length, 0);
            assert.equal(view.$('.os-general').length, 0);
          });
      });

      it('formats the service name correctly depending on the always redirect param', function () {
        createView(VerificationReasons.SIGN_UP);
        var serviceName = 'Find My Device';
        var redirectUri = 'https://find.firefox.com';
        relier.set('redirectUri', redirectUri);
        relier.set('serviceName', serviceName);
        assert.isFalse(view.context().shouldShowProceedButton);

        relier.set('verificationRedirect', 'always');
        assert.isTrue(view.context().shouldShowProceedButton);

        relier.set('redirectUri', null);
        assert.isFalse(view.context().shouldShowProceedButton);
      });

      it('shows the `proceed` button for verification_redirect', function () {
        relier.set('serviceName', 'Find My Device');
        relier.set('redirectUri', 'https://find.firefox.com');
        relier.set('verificationRedirect', 'always');

        relier.isSync = sinon.spy(function () {
          return false;
        });

        createView(VerificationReasons.SIGN_UP);

        return view.render()
          .then(function () {
            assert.ok(view.$('#proceed').length);
          });
      });
    });

    describe('submit', function () {
      beforeEach(function () {
        createDeps();
      });

      afterEach(function () {
        view.remove();
        view.destroy();
      });

      it('for `proceed` - submit metrics, redirect to verification_redirect', function () {
        var redirectUri = 'https://find.firefox.com';

        relier.set('redirectUri', redirectUri);
        relier.set('verificationRedirect', 'always');

        relier.isSync = sinon.spy(function () {
          return false;
        });

        createView(VerificationReasons.SIGN_UP);

        return view.submit().then(function () {
          assert.isTrue(metrics.flush.calledOnce);
          assert.lengthOf(metrics.flush.getCall(0).args, 0);
          assert.equal(windowMock.location.href, redirectUri);
        });
      });


    });
  });
});
