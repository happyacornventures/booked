import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function CalendarList() {
  const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
  const [booked, setBooked] = useState<Calendar.Calendar | null>(null);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [events, setEvents] = useState<Calendar.Event[]>([]);

  useEffect(() => {
    (async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        setCalendars(cals);
      } else {
        console.warn('Calendar permission not granted');
      }
    })();
  }, []);

  useEffect(() => {
    const createDefaultCalendar = async () => {
        if (calendars.length === 0) return;
        let booked = calendars.find(cal => cal.title === 'Booked');
        if(booked) setBooked(booked);
        if (!booked) {
            const defaultCalendarSource = Platform.OS === 'ios'
                ? (await Calendar.getDefaultCalendarAsync()).source
                : { isLocalAccount: true, name: 'Booked', type: 'local' };

            const booked = await Calendar.createCalendarAsync({
                title: 'Booked',
                color: '#FF5733',
                entityType: Calendar.EntityTypes.EVENT,
                source: defaultCalendarSource,
                name: 'Booked',
                accessLevel: Calendar.CalendarAccessLevel.OWNER,
                ownerAccount: 'ghost',
            });
        }
    }

    createDefaultCalendar();

  }, [calendars]);

  const fetchEvents = async (days: number = 14) => {
    if (selectedCalendars.length === 0) {
      setEvents([]);
      return;
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    let allEvents: Calendar.Event[] = [];

    for (const calendarId of selectedCalendars) {
      try {
        const calendarEvents = await Calendar.getEventsAsync(
          [calendarId],
          startDate,
          endDate
        );
        allEvents = [...allEvents, ...calendarEvents];
      } catch (error) {
        console.error(`Error fetching events for calendar ${calendarId}:`, error);
      }
    }

    setEvents(allEvents);
  };

  useEffect(() => {
    fetchEvents(90); // Fetch events for the next 90 days
  }, [selectedCalendars]);

  const toggleCalendarSelection = (calendarId: string) => {
    setSelectedCalendars(prevSelected =>
      prevSelected.includes(calendarId)
        ? prevSelected.filter(id => id !== calendarId)
        : [...prevSelected, calendarId]
    );
  };

  return (
    <ScrollView>
      <Text style={{ fontSize: 24, margin: 10 }}>Available Calendars:</Text>
      {calendars.map((cal) => (
        <TouchableOpacity
          key={cal.id}
          style={{ flexDirection: 'row', alignItems: 'center', margin: 10 }}
          onPress={() => toggleCalendarSelection(cal.id)}
        >
          <Ionicons
            name={selectedCalendars.includes(cal.id) ? "checkbox-outline" : "square-outline"}
            size={24}
            color="black"
          />
          <View style={{ marginLeft: 10 }}>
            <Text>Name: {cal.title}</Text>
            {/* <Text>Source: {cal.source.name}</Text>
            <Text>Type: {cal.source.type}</Text> */}
          </View>
        </TouchableOpacity>
      ))}
      <Text style={{ fontSize: 24, margin: 10 }}>Booked Calendar:</Text>
      {booked ? (
        <View style={{ margin: 10 }}>
          <Text>Name: {booked.title}</Text>
          {/* <Text>Source: {booked.source.name}</Text>
          <Text>Type: {booked.source.type}</Text> */}
        </View>
      ) : (
        <Text>No booked calendar found.</Text>
      )}
      <Text style={{ fontSize: 24, margin: 10 }}>Selected Calendars:</Text>
      {selectedCalendars.map(id => {
        const cal = calendars.find(c => c.id === id);
        return cal ? <Text key={id}>{cal.title}</Text> : null;
      })}

      <Text style={{ fontSize: 24, margin: 10 }}>Events:</Text>
      {events.length > 0 ? (
        events.map((event, index) => (
          <View key={index} style={{ margin: 10 }}>
            <Text>Title: {event.title}</Text>
            <Text>Start: {event.startDate}</Text>
            <Text>End: {event.endDate}</Text>
          </View>
        ))
      ) : (
        <Text>No events found for the selected calendars.</Text>
      )}
    </ScrollView>
  );
}