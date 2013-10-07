var KCRWBuddy = (function(){
  
  // data to pull AJAX data from. currently, we're pulling from the same host 
  // to avoid cross-domain issues. this accomplished by a simple apache 
  // proxypass directive that passes the request to kcrw.org.
  var AJAX_HOSTNAME = window.location.host;
  
  // KCRW's default album art image
  var DEFAULT_ALBUM_ART = "/images/no_album.jpg";

  // let's not be too noisy. KCRW has their web page throttled to every 20s, 
  // so let's do the same.
  var REFRESH_INTERVAL = 20 * 1000;

  // holds timeout reference so we can cancel it if need be
  var timeout = null;

  function retrieveNowPlaying(){
    // values are "Music" (Eclectic 24) or "Simulcast"
    var channel = "Music";

    // channel seems to be the only required parameter to retrieve the now 
    // playing data for the "Music" channel
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

    // show everything now that we have data
    // yeah, this will get called every time, but who cares. it's harmless.
    $('#now-playing').removeClass('invisible');
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
      time     : null,
      albumart : markup.find('.buy img').attr('src'),
      website  : markup.find('.details a').attr('href')
    };

    return song_data;
  }

  // correct some things about the parsed data
  function fixNowPlayingData(data){

    // accepts time string in KCRW format, returns moment.js time object
    function fixTimezone(datetime){
      // correct the time to be in user's timezone, not America/Los_Angeles, 
      // where KCRW is and what their dates are output as.
      // 
      // i need a way to *interpret* the time in America/Los_Angeles and then 
      // display it in the local time zone. you'd think this would be easy, but 
      // it's not, due to detecting and accounting for DST.
      // 
      // the simplest approach seems to be detect DST and then hardcode the # of 
      // hours offset when making a new date. this is nearly perfect except 
      // that during the DST transition, it will not be correct because we're 
      // testing DST based on *our* timezone, not LA's. at least that's what i 
      // *think* will happen. needs more testing in any case.
      // 
      // also note that the date is output without leading zeros for the hour:
      // 
      //   2013-10-07 5:38 am
      // 
      // Date.parse can handle this format (in chrome, at least), but 
      // Date.parse does not work well across browsers. (see 
      // <http://stackoverflow.com/questions/3085937/>) Instead, we're using 
      // moment.js and its ability to parse dates according to a specified 
      // format.
      // 
      var KCRW_DATETIME_FORMAT = "YYYY-MM-DD h:mm a";
      var song_start_datetime = moment(datetime, KCRW_DATETIME_FORMAT);

      // LA is -7 hours during DST, and -8 hours at other times
      var offset = song_start_datetime.isDST() ? "-0700" : "-0800";

      // re-parse with the correct GMT offset
      song_start_datetime = moment(datetime + ' GMT' + offset, (KCRW_DATETIME_FORMAT + " [GMT]Z"));

      return song_start_datetime;
    }

    // fix the timezone and store it as a new attribute for display
    data.time = fixTimezone(data.datetime).format('h:mm A');
    


    return data;
  }

  // shove the data into our page
  function displayNowPlaying(data){
    // link to artist website if available
    if (data.website) {
      $('#artist').html('<a href="' + data.website + '" target="_blank">' + data.artist + '<\/a>');
    } else {
      $('#artist').html(data.artist);
    }

    $('#song').html(data.song);

    if (!data.album) {
      $('#album-info').hide();
      $('#album').html("");
    } else {
      $('#album').html(data.album);
      $('#album-info').show();
    }

    // don't show the square parens if there's no label
    if (!data.label) {
      $('#label-info').hide();
      $('#label').html("");
    } else {
      $('#label').html(data.label);
      $('#label-info').show();
    }

    $('#time').html(data.time);

    if (!data.albumart) {
      $('#albumart').attr('src', DEFAULT_ALBUM_ART);
    } else {
      $('#albumart').attr('src', data.albumart);
    }
  }

  function handleAlbumArtClick() {
    // stop the timer before we refresh the data
    clearTimeout(timeout);

    retrieveNowPlaying();
  }

  return {
    init : function(){
      retrieveNowPlaying();

      // hidden feature! click the album art to refresh
      $('#albumart').on('click', handleAlbumArtClick)
    }
  };

}());

KCRWBuddy.init();
