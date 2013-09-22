
var Chat = oHelpers.createClass(
{
    _oSocket: null,
    _oWorkspace: null,
    _aHistory: null,
    _aTypingUsers: null,
    _bTyping: false,
    _iTypingTimeout: null,
    _iUnseen: 0,
    
    __type__: 'PeoplePane',    

    __init__: function(oWorkspace, oSocket)
    {
        // Save data.
        this._oSocket = oSocket;
        this._oWorkspace = oWorkspace;
        this._aCurUsers = [];
        this._aHistory = [];
        this._aTypingUsers = [];
        
        // Listen to socket events.
        this._oSocket.bind('message', this, this._handleServerAction);
    },
    
    onOpen: function()
    {
        this._bChatOpen = true;
        this._iUnseen = 0;
        this._reRender();
    },
    
    onClose: function()
    {
        console.log('on close');
        this._bChatOpen = false;
    },
    
    onEvent: function(oEvent)
    {
        // Get data.
        var jTarget = $(oEvent.target);
        var jActiveElem = $(document.activeElement);
        var sEventType = oEvent.type;

        if (sEventType == 'click')
        {
            if (jTarget.is('#chat-identify-ok-button'))
                this._changeClientID($('#chat-identify').val());
            return;
        }
        
        if (sEventType == 'keypress')
        {
            if (jActiveElem.closest('#chat-identify-wrapper').length)
            {
                if (oEvent.which == 13)
                    this._changeClientID($('#chat-identify').val());
                return;                
            }
            if (jTarget.is('#chat-box'))
            {
                if (oEvent.which == 13)
                {
                    this._clearTyping();
                    this._sendNewMessage($('#chat-box').val());
                    $('#chat-box').val('');
                    oEvent.preventDefault();
                }
                else
                {
                    if (!this._bTyping)
                    {
                        this._oSocket.send('startTyping');
                        this._bTyping = true;
                    }
                    
                    if (this._iTypingTimeout)
                        window.clearTimeout(this._iTypingTimeout);
                    
                    this._iTypingTimeout = window.setTimeout(
                        oHelpers.createCallback(this, this._clearTyping),
                        1000
                    );
                }
            }            
        }

        if (sEventType == 'blur')
        {
            if (jTarget.is('#username'))
                this._changeClientID(jTarget.val());
        }
    },

    _handleServerAction: function(oAction)
    {
        switch(oAction.sType)
        {
            case 'newChatMessage':
                this._addNewChatMessage(oAction.oData.sClientID, oAction.oData.sMessage);
                break;
                
            case 'startTyping':
                this._aTypingUsers.push(oAction.oData.sClientID);
                this._reRender();
                break;
                
            case 'endTyping':
                this._aTypingUsers.splice(this._aTypingUsers.indexOf(oAction.oData.sClientID), 1);
                this._reRender();
                break;

            case 'invalidClientIDChange':
                $('#chat-identify-error-message').text(oAction.oData.sReason);
                break;

            case 'newClientIDAccepted':
                
                // Save username.
                this._oWorkspace.getUserInfo()['sClientID'] = oAction.oData.sClientID;
                
                // Show chat box.
                $('#chat').removeClass('identify');
                $('#chat-box').prop('disabled', false);
                
                // Focus chat.
                var jActiveElem = $(document.activeElement);
                if (jActiveElem.parents('.toolbar-item').is('#chat-menu'))
                    $('#chat-box').focus();
                
                break;
            
            default:
                return false;
        }
        return true;
    },

    _addNewChatMessage: function(sClientID, sMessage)
    {
        if (!this._bChatOpen)
            this._iUnseen++;
            
        this._aHistory.push(
        {
            'sClientID': sClientID,
            'sMessage': sMessage
        });
        this._reRender();
    },

    _changeClientID: function(sClientID)
    {
        this._oSocket.send('changeClientID',
        {
            'sClientID': sClientID
        });

        this._oWorkspace.getUserInfo()['sClientID'] = sClientID;
    },

    _sendNewMessage: function(sMessage)
    {
        sMessage = sMessage.replace(/^\s+|\s+$/g, "");
        if (!sMessage)
            return;

        this._oSocket.send('newChatMessage',
        {
            'sMessage': sMessage
        });
        this._aHistory.push(
        {
            'sClientID': this._oWorkspace.getUserInfo()['sClientID'],
            'sMessage': sMessage
        });

        this._reRender();
    },

    _reRender: function()
    {
        // Remove old comments.
        var jHistory = $('#chat-history');
        jHistory.empty();

        // Show chat history.
        for (var i = 0; i < this._aHistory.length; i++)
        {
            var oMessage = this._aHistory[i];
            var jMessage = $(
                '<div class="chat-message">' +
                   '<span class="chat-message-from"></span>' +
                   '<span class="chat-message-text"></span>' +
                '</div>'
            );
            jMessage.find('.chat-message-from').text(oMessage.sClientID + ': ');
            jMessage.find('.chat-message-text').text(oMessage.sMessage);
            jHistory.append(jMessage);
        }

        // Show currently typing.
        $('#chat-typing-names').text(this._englishFormatArray(this._aTypingUsers));

        // Update the notifications.
        $('#chat-unread-count').text(this._iUnseen);
        $('#chat-unread-count').toggle(!!this._iUnseen);
    },

    _englishFormatArray: function(aArray)
    {
        if (aArray.length === 0)
            return '';

        if (aArray.length === 1)
            return aArray[0];

        if (aArray.length === 2)
            return aArray.join(' and ');

        return aArray.slice(0, -1).join(', ') + ' and ' + aArray[aArray.length - 1];
    },

    _clearTyping: function()
    {
        window.clearTimeout(this._iTypingTimeout);
        this._bTyping = false;
        this._iTypingTimeout = null;
        this._oSocket.send('endTyping');
    },
    
    _isPaneOpen: function()
    {
        return $('#workspace').hasClass('people-pane-expanded');
    }
});

