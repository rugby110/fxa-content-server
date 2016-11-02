/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Generic module to use if a view is a form. This module provides a common
 * way to do form validation and invalid element reporting. Descendent modules
 * can provide strategies for the following functions:
 * - isValidStart (optional)
 * - isValidEnd (optional)
 * - showValidationErrorsStart (optional)
 * - showValidationErrorsEnd (optional)
 * - beforeSubmit (optional)
 * - submit (required)
 * - afterSubmit (optional)
 *
 * See documentation for an explanation of each.
 */

define(function (require, exports, module) {
  'use strict';

  require('views/elements/jquery-plugin');

  const $ = require('jquery');
  const _ = require('underscore');
  const allowOnlyOneSubmit = require('views/decorators/allow_only_one_submit');
  const AuthErrors = require('lib/auth-errors');
  const BaseView = require('views/base');
  const Duration = require('duration');
  const notifyDelayedRequest = require('views/decorators/notify_delayed_request');
  const p = require('lib/promise');
  const showButtonProgressIndicator = require('views/decorators/progress_indicator');
  const Tooltip = require('views/tooltip');


  /**
   * Decorator that checks whether the form has changed, and if so, call
   * the specified handler.
   * Called if `keypress` or `change` is fired on the form.
   *
   * @param {Function} handler
   * @returns {Function}
   */
  function ifFormValuesChanged(handler) {
    return function () {
      if (this.updateFormValueChanges()) {
        return this.invokeHandler(handler, arguments);
      }
    };
  }

  const proto = BaseView.prototype;

  var FormView = BaseView.extend({

    // Time to wait for a request to finish before showing a notice
    LONGER_THAN_EXPECTED: new Duration('10s').milliseconds(),

    constructor (options) {
      BaseView.call(this, options);

      // attach events of the descendent view and this view.
      this.delegateEvents(_.extend({}, FormView.prototype.events, this.events));
    },

    events: {
      'change form': ifFormValuesChanged(BaseView.cancelEventThen('enableSubmitIfValid')),
      'input form': ifFormValuesChanged(BaseView.cancelEventThen('enableSubmitIfValid')),
      'keyup form': ifFormValuesChanged(BaseView.cancelEventThen('enableSubmitIfValid')),
      'submit form': BaseView.preventDefaultThen('validateAndSubmit')
    },

    afterRender () {
      // Firefox has a strange issue where if the previous
      // screen was submit using the keyboard, the `enter` key's
      // `keyup` event fires here on the element that receives
      // focus. Without seeding the initial form values, any
      // errors passed from the previous screen are immediately
      // hidden.
      this.updateFormValueChanges();

      // only enable submit if no error is passed
      // from one screen to the next.
      if (! this.model.has('error')) {
        this.enableSubmitIfValid({ hideError: false, hideSuccess: false });
      }

      return proto.afterRender.call(this);
    },

    /**
     * Get the current form values. Does not fetch the value of elements with
     * the `data-novalue` attribute.
     *
     * @method getFormValues
     * @returns {Object}
     */
    getFormValues () {
      var values = {};
      var inputEls = this.$('input,textarea,select');

      for (var i = 0, length = inputEls.length; i < length; ++i) {
        var el = $(inputEls[i]);
        // elements that have data-novalue (like password show fields)
        // are not added to the values.
        if (typeof el.attr('data-novalue') === 'undefined') {
          var name = el.attr('name') || el.attr('id');
          values[name] = this.getElementValue(el);
        }
      }

      return values;
    },

    enableSubmitIfValid (options = {}) {
      // the change event can be called after the form is already
      // submitted if the user presses "enter" in the form. If the
      // form is in the midst of being submitted, bail out now.
      if (this.isSubmitting() || this.isHalted()) {
        return;
      }

      // hide success and error messages after user changes the form
      if (options.hideError !== false) {
        this.hideError();
      }
      if (options.hideSuccess !== false) {
        this.hideSuccess();
      }
      if (this.isValid()) {
        this.enableForm();
      } else {
        this.disableForm();
      }
    },

    /**
     * TODO - this should be called disableSubmit
     */
    disableForm () {
      // the disabled class is used instead of the disabled attribute
      // so that the submit handler is still called. With the submit attribute
      // applied, no submit handler is fired, and the form validation does not
      // take place.
      this.$('button[type=submit]').addClass('disabled');
      this._isFormEnabled = false;
    },

    enableForm () {
      this.$('button[type=submit]').removeClass('disabled');
      this._isFormEnabled = true;
    },

    _isFormEnabled: true,
    isFormEnabled () {
      return !! this._isFormEnabled;
    },

    /**
     * Validate and if valid, submit the form.
     *
     * If the form is valid, three functions are run in series using
     * a promise chain: beforeSubmit, submit, and afterSubmit.
     *
     * By default, beforeSubmit and afterSubmit are used to prevent
     * multiple concurrent form submissions. The form is disbled in
     * beforeSubmit, and if no error is displayed, the form is re-enabled
     * in afterSubmit. This behavior can be overridden in subclasses.
     *
     * Form submission is prevented if beforeSubmit resolves to false.
     *
     * Functions can return a promise to allow for asynchronous operations.
     *
     * If a function throws an error or returns a rejected promise,
     * displayError will display the error to the user.
     *
     * @method validateAndSubmit
     * @return {Promise}
     */
    validateAndSubmit: allowOnlyOneSubmit(function validateAndSubmit (event) {
      if (event) {
        event.stopImmediatePropagation();
      }

      this.trigger('submitStart');

      return p()
        .then(() => {
          if (this.isHalted()) {
            return;
          }

          if (! this.isValid()) {
            // Validation error is surfaced for testing.
            throw this.showValidationErrors();
          }

          // the form enabled check is done after the validation check
          // so that the form's `submit` handler is triggered and validation
          // error tooltips are displayed, even if the form is disabled.
          if (! this.isFormEnabled()) {
            // form is disabled, get outta here.
            return;
          }

          // all good, do the beforeSubmit, submit, and afterSubmit chain.
          this.logViewEvent('submit');
          return this._submitForm();
        });
    }),

    _submitForm: notifyDelayedRequest(showButtonProgressIndicator(function () {
      return p()
        .then(_.bind(this.beforeSubmit, this))
        .then((shouldSubmit) => {
          // submission is opt out, not opt in.
          if (shouldSubmit !== false) {
            return this.submit();
          }
        })
        .fail((err) => {
          // display error and surface for testing.
          this.displayError(err);
          throw err;
        })
        .then(_.bind(this.afterSubmit, this));
    })),

    /**
     * Checks whether the form is valid. Checks the validitity of each
     * form element. If any elements are invalid, returns false.
     *
     * No errors are displayed.
     *
     * Descendent views can override isValidStart or isValidEnd to perform
     * view specific checks.
     *
     * @returns {Boolean}
     */
    isValid () {
      if (! this.isValidStart()) {
        return false;
      }

      const inputEls = this.$('input');
      for (var i = 0, length = inputEls.length; i < length; ++i) {
        var $el = this.$(inputEls[i]);
        try {
          $el.validate();
        } catch (e) {
          return false;
        }
      }

      return this.isValidEnd();
    },

    /**
     * Check form for validity.  isValidStart is run before
     * input elements are checked. Descendent views only need to
     * override to do any form specific checks that cannot be
     * handled by the generic handlers.
     *
     * @return {Boolean} true if form is valid, false otw.
     */
    isValidStart () {
      return true;
    },

    /**
     * Check form for validity.  isValidEnd is run after
     * input elements are checked. Descendent views only need to
     * override to do any form specific checks that cannot be
     * handled by the generic handlers.
     *
     * @return {Boolean} true if form is valid, false otw.
     */
    isValidEnd () {
      return true;
    },

    /**
     * Display form validation errors.
     *
     * Descendent views can override showValidationErrorsStart
     * or showValidationErrorsEnd to display view specific messages.
     *
     * @returns {undefined}
     */
    showValidationErrors () {
      this.hideError();

      if (this.showValidationErrorsStart()) {
        // only one message at a time.
        return;
      }

      const inputEls = this.$('input');
      for (var i = 0, length = inputEls.length; i < length; ++i) {
        const el = inputEls[i];
        const $el = this.$(el);

        try {
          $el.validate();
        } catch (validationError) {
          this.showValidationError(el, validationError);
          // only one message at a time.
          return;
        }
      }

      this.showValidationErrorsEnd();
    },

    /**
     * Get an element value, trimming the value of whitespace if necessary
     *
     * @param {String} el
     * @returns {String}
     */
    getElementValue (el) {
      return this.$(el).val();
    },

    /**
     * Display form validation errors. isValidStart is run before
     * input element validation errors are displayed. Descendent
     * views only need to override to show any form specific
     * validation errors that are not handled by the generic handlers.
     *
     * @return {undefined} true if a validation error is displayed.
     */
    showValidationErrorsStart () {
    },

    /**
     * Display form validation errors. isValidEnd is run after
     * input element validation errors are displayed. Descendent
     * views only need to override to show any form specific
     * validation errors that are not handled by the generic handlers.
     *
     * @return {undefined} true if a validation error is displayed.
     */
    showValidationErrorsEnd () {
    },

    /**
     * Show a form validation error to the user in the form of a tooltip.
     *
     * @param {String} el
     * @param {Error} err
     * @returns {String}
     */
    showValidationError (el, err) {
      this.logError(err);

      var invalidEl = this.$(el);
      var message = AuthErrors.toMessage(err);

      var tooltip = new Tooltip({
        invalidEl: invalidEl,
        message: message
      });

      tooltip.on('destroyed', () => {
        invalidEl.removeClass('invalid');
        this.trigger('validation_error_removed', el);
      }).render().then(() => {
        try {
          invalidEl.addClass('invalid').get(0).focus();
        } catch (e) {
          // IE can blow up if the element is not visible.
        }

        // used for testing
        this.trigger('validation_error', el, message);
      });

      this.trackChildView(tooltip);

      return message;
    },

    /**
     * Descendent views can override.
     *
     * Descendent views may want to override this to allow multiple form
     * submissions or to disable form submissions. Return false or a
     * promise that resolves to false to prevent form submission.
     *
     * @returns {Promise|Boolean|none} Return a promise if
     *   beforeSubmit is an asynchronous operation.
     */
    beforeSubmit () {
      return this.disableForm();
    },

    /**
     * Descendent views should override.
     *
     * Submit form data to the server. Only called if isValid returns true
     * and beforeSubmit does not return false.
     *
     */
    submit () {
    },

    /**
     * Descendent views can override.
     *
     * Descendent views may want to override this to allow
     * multiple form submissions.
     *
     * @param {Object} result
     * @returns {Promise|none} Return a promise if afterSubmit is
     *   an asynchronous operation.
     */
    afterSubmit (result) {
      return p().then(() => {
        // the flow may be halted by an authentication broker after form
        // submission. Views may display an error without throwing an exception.
        // Ensure the flow is not halted and and no errors are visible before
        // re-enabling the form. The user must modify the form for it to
        // be re-enabled.

        if (result && result.halt) {
          this.halt();
        } else if (! this.isErrorVisible()) {
          this.enableForm();
        }

        return result;
      });
    },

    /**
     * Check if the form is currently being submitted
     *
     * @returns {Boolean} true if form is being submitted, false otw.
     */
    isSubmitting () {
      return this._isSubmitting;
    },

    /**
     * Halt! Disable form edits, submission.
     *
     * TODO - this should be named disableForm, but that name is already taken.
     */
    halt () {
      this.$('input,textarea,button').attr('disabled', 'disabled').blur();
      this._isHalted = true;
    },

    /**
     * Check if the view is halted
     *
     * @returns {Boolean} true if the view is halted, false otw.
     */
    isHalted () {
      return this._isHalted;
    },

    /**
     * Detect if form values have changed
     *
     * @returns {Object|null} the form values or null if they haven't changed.
     */
    detectFormValueChanges () {
      // oldValues will be `undefined` the first time through.
      var oldValues = this._previousFormValues;
      var newValues = this.getFormValues();

      if (! _.isEqual(oldValues, newValues)) {
        return newValues;
      }

      return null;
    },

    /**
     * Detect if form values have changed and use the new
     * values as the baseline to detect future changes.
     *
     * @returns {Object|null} the form values or null if they haven't changed.
     */
    updateFormValueChanges () {
      var newValues = this.detectFormValueChanges();
      if (newValues) {
        this._previousFormValues = newValues;
      }
      return newValues;
    }
  });

  module.exports = FormView;
});
