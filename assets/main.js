var KCRWBuddy = (function(){
  
  // data to pull AJAX data from. this is just an simple apache proxypass 
  // directive that passes the request to kcrw.org to avoid cross-domain 
  // issues
  var AJAX_HOSTNAME = 'kcrw-buddy.dev';

  // let's not be too noisy. KCRW has their web page throttled to every 20s, 
  // so let's do the same.
  var REFRESH_INTERVAL = 20 * 1000;

  // holds timeout reference so we can cancel it if need be
  var timeout = null;

  function retrieveNowPlaying(){
    // values are "Music" or "Simulcast"
    var channel = "Music";

    // channel seems to be the only required parameter to retrieve the now playing data for the "Music" channel
    var request_data = {
      "channel" : channel
      // "dates" : "2013-10-03",
      // "hours" : "13",
      // "drive_flag" : "0"
    };

    // fetch the JSON data via AJAX
    $.ajax({
      'type'     : 'GET',
      'url'      : 'http://' + AJAX_HOSTNAME + '/tracklists/includes/table_currenthour.php?data=' + JSON.stringify(request_data),
      'dataType' : 'json',
      'success'  : handleResponseSuccess,
      'error'    : handleResponseError
    });
  }

  function handleResponseSuccess(data){
    // parse and tweak the data
    var song_data = parseNowPlayingData($(data.message));
    song_data = fixNowPlayingData(song_data);

    // show the data
    displayNowPlaying(song_data);

    // load more data later
    timeout = setTimeout(retrieveNowPlaying, REFRESH_INTERVAL);
  }

  function handleResponseError(data){
    // FIXME: do something more intelligent here
    console.log("handleResponseError");
    console.log(arguments);
  }

  // pull the data out of HTML and into an object
  function parseNowPlayingData(markup){
    var song_data = {
      // FIXME: wonder how text() handles HTML entities
      song     : markup.children('.song').text(),
      artist   : markup.children('.artist').text(),
      album    : markup.children('.album').text(),
      label    : markup.children('.label').text(),
      datetime : markup.find('.time span').text(),
      albumart : markup.find('.buy img').attr('src'),
      website  : ''
    };

    return song_data;
  }

  // correct some things about the parsed data
  function fixNowPlayingData(data){
    // FIXME: correct the time to be in user's timezone, not Pacific Time
    // 
    // note: keep time stored as string; easier that way since we're not 
    // doing any further calcs
    data.datetime = data.datetime;

    return data;
  }

  // shove the data into our page
  function displayNowPlaying(data){
    $('#albumart').attr('src', data.albumart);
    $('#artist').html(data.artist);
    $('#song').html(data.song);
    $('#album').html(data.album);
    $('#label').html(data.label);
    $('#datetime').html(data.datetime);
  }


  return {
    init : function(){
      retrieveNowPlaying();
    }
  };

}());

KCRWBuddy.init();
