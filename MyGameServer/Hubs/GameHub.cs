using Microsoft.AspNetCore.SignalR;
using System;
using System.Threading.Tasks;

namespace MyGameServer.Hubs
{
    public class GameHub : Hub
    {
        public GameHub()
        {
        }

        public async Task ConnectToMatch(string matchId) {
            await Groups.AddToGroupAsync(Context.ConnectionId, matchId);
            await Clients.Client(Context.ConnectionId).SendAsync("OnConnectedToMatch");
        }

        public async Task DisconnectFroMatch(string matchId) {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, matchId);
        }

        public async Task SendEventToOtherMatchClients(string match, object @event) {
            await Clients.Group(match).SendAsync("OnSendEventToOtherMatchClients", @event);
        }
    }
}
